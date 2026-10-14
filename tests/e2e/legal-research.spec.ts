import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'test-e2e@example.com',
  password: 'TestPass123!',
};

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/dashboard', { timeout: 30000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Legal research (Prompt 3)', () => {
  test('legal-ask grounds a limitation question with verified citations', async ({ page }) => {
    await login(page);

    const response = await page.request.post('/api/legal-ask', {
      data: { question: 'What is the limitation period for filing a consumer complaint?' },
      timeout: 90000,
    });
    if (!response.ok()) console.log('legal-ask status:', response.status(), await response.text());
    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.data.insufficient).toBe(false);
    expect(body.data.answer).toBeTruthy();
    expect(body.data.answer).not.toContain('corpus does not cover this');
    expect(body.data.citationCheck.allVerified).toBe(true);
    expect(body.data.citationCheck.verifiedCount).toBeGreaterThan(0);
    expect(JSON.stringify(body.data)).toMatch(/s\.69|Section 69/i);
    expect(body.data.authorities.length).toBeGreaterThan(0);
    expect(['vector', 'vector+rerank']).toContain(body.data.retrieval.strategy);
  });

  test('legal-ask reports a gap instead of fabricating a citation', async ({ page }) => {
    await login(page);

    const response = await page.request.post('/api/legal-ask', {
      data: { question: 'What is the limitation period under the Motor Vehicles Act, 2019?' },
      timeout: 90000,
    });
    if (!response.ok()) console.log('gap-question status:', response.status(), await response.text());
    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // Two-layer defense: retrieval may return semantically-adjacent chunks
    // (limitation topics), so `insufficient` can legitimately be false — the
    // guarantee under test is that no citation gets fabricated either way.
    const answersGap =
      body.data.insufficient === true || String(body.data.answer ?? '').includes('does not cover');
    expect(answersGap).toBe(true);
    expect(body.data.citations).toEqual([]);
    expect(JSON.stringify(body.data)).not.toContain('Motor Vehicles Act');
  });

  test('legal-search is pure retrieval with no LLM call', async ({ page }) => {
    await login(page);

    const response = await page.request.post('/api/legal-search', {
      data: { query: 'D Souza expert opinion before summoning doctor' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.data.chunks.length).toBeGreaterThan(0);
    expect(body.data.retrieval.strategy).toBeTruthy();
    expect(typeof body.data.retrieval.totalMs).toBe('number');
  });

  test('legal-ask and legal-search require authentication', async ({ request }) => {
    const ask = await request.post('/api/legal-ask', { data: { question: 'limitation period?' } });
    expect(ask.status()).toBe(401);
    const search = await request.post('/api/legal-search', { data: { query: 'limitation' } });
    expect(search.status()).toBe(401);
  });

  test('legal research page renders with nav entry', async ({ page }) => {
    await login(page);

    await expect(page.locator('a:has-text("Legal research")')).toBeVisible();
    await page.goto('/dashboard/legal');
    await expect(page.locator('h1:has-text("Legal research")')).toBeVisible();
    await expect(page.locator('button:has-text("Ask")')).toBeVisible();
    await expect(page.locator('button:has-text("Search only (no AI)")')).toBeVisible();
    await expect(page.locator('button:has-text("Statute")')).toBeVisible();
  });
});
