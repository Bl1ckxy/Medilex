import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'test-e2e@example.com',
  password: 'TestPass123!',
};

const VIEWPORTS = [
  { name: 'w375', width: 375, height: 812 },
  { name: 'w768', width: 768, height: 1024 },
  { name: 'w1280', width: 1280, height: 800 },
];

const PUBLIC_PAGES = ['/', '/auth/login', '/auth/signup'];
const PRIVATE_PAGES = [
  '/dashboard',
  '/dashboard/cases',
  '/dashboard/evidence',
  '/dashboard/odr',
  '/dashboard/legal',
  '/dashboard/settings',
];
const CASE_TABS = ['Evidence', 'Analysis', 'Counsel review', 'ODR & filing'];

function slug(url: string) {
  return url.replace(/\W+/g, '_');
}

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/dashboard', { timeout: 30000 });
}

async function evaluateOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const overflowPx = doc.scrollWidth - vw;
    const offenders: string[] = [];
    if (overflowPx > 1) {
      const found: Array<{ right: number; desc: string }> = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1) {
          const cls =
            typeof el.className === 'string' && el.className
              ? '.' + el.className.split(/\s+/).slice(0, 4).join('.')
              : '';
          const text = (el.textContent ?? '').trim().slice(0, 40);
          found.push({
            right: Math.round(r.right),
            desc: `${el.tagName.toLowerCase()}${cls} w=${Math.round(r.width)} right=${Math.round(r.right)} text="${text}"`,
          });
        }
      }
      found.sort((a, b) => b.right - a.right);
      for (const f of found.slice(0, 6)) offenders.push(f.desc);
    }
    return { overflowPx, offenders };
  });
}

async function measure(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'networkidle' });
  return evaluateOverflow(page);
}

async function report(
  page: Page,
  findings: Array<Record<string, unknown>>,
  vpName: string,
  url: string,
  result: { overflowPx: number; offenders: string[] },
) {
  findings.push({ url, ...result });
  const base = `test-results/responsive/${vpName}`;
  if (result.overflowPx > 1) {
    await page.screenshot({ path: `${base}-OVERFLOW-${slug(url)}.png`, fullPage: true });
  }
  await page.screenshot({ path: `${base}-FULL-${slug(url)}.png`, fullPage: true });
}

for (const vp of VIEWPORTS) {
  test(`responsive audit ${vp.name}`, async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const findings: Array<Record<string, unknown>> = [];

    for (const url of PUBLIC_PAGES) {
      await report(page, findings, vp.name, url, await measure(page, url));
    }

    await login(page);

    for (const url of PRIVATE_PAGES) {
      await report(page, findings, vp.name, url, await measure(page, url));
    }

    // Case detail: discover first real case link from the list page.
    await page.goto('/dashboard/cases', { waitUntil: 'networkidle' });
    const caseHref = await page.evaluate(() => {
      const hrefs = Array.from(document.querySelectorAll('a[href^="/dashboard/cases/"]'))
        .map((l) => l.getAttribute('href') ?? '')
        .filter((h) => /\/dashboard\/cases\/[0-9a-f-]{36}/.test(h));
      return hrefs[0] ?? null;
    });
    if (caseHref) {
      await report(page, findings, vp.name, caseHref, await measure(page, caseHref));

      for (const label of CASE_TABS) {
        const tab = page.locator(`button:has-text("${label}")`).first();
        if ((await tab.count()) === 0) continue;
        await tab.click();
        await page.waitForLoadState('networkidle');
        const result = await evaluateOverflow(page);
        const url = `${caseHref} [${label}]`;
        findings.push({ url, ...result });
        if (result.overflowPx > 1) {
          await page.screenshot({ path: `test-results/responsive/${vp.name}-OVERFLOW-tab-${slug(label)}.png`, fullPage: true });
        }
        await page.screenshot({ path: `test-results/responsive/${vp.name}-FULL-tab-${slug(label)}.png`, fullPage: true });
      }
    } else {
      findings.push({ url: '/dashboard/cases [detail]', overflowPx: -1, offenders: ['NO CASE FOUND'] });
    }

    for (const f of findings) {
      console.log('AUDIT ' + JSON.stringify({ vp: vp.name, ...f }));
    }

    const overflows = findings.filter((f) => (f.overflowPx as number) > 1);
    expect(overflows, `Horizontal overflow at ${vp.name}: ${JSON.stringify(overflows, null, 2)}`).toHaveLength(0);
  });
}
