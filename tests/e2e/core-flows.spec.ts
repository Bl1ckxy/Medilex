import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'test-e2e@example.com',
  password: 'TestPass123!',
};

const CASE_DATA = {
  patientName: 'Rahul Deshmukh',
  patientAge: 45,
  patientGender: 'male',
  nextOfKin: 'Priya Deshmukh',
  nextOfKinRelation: 'Wife',
  hospitalName: 'Apollo Hospital',
  hospitalType: 'private',
  hospitalCity: 'Mumbai',
  hospitalState: 'Maharashtra',
  negligenceType: 'delayed_treatment',
  severity: 'permanent_disability',
  incidentDate: '2024-01-15T10:00:00.000Z',
  incidentDescription: 'Patient admitted with chest pain. Delayed ECG and troponin testing by 6 hours. Resulted in missed STEMI diagnosis and permanent cardiac damage.',
  claimAmount: 5000000,
  treatingDoctorName: 'Dr. A. Kumar',
  treatingDoctorRegistration: 'MMC-12345',
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

async function createCase(page: Page, data = CASE_DATA) {
  // Use API to create case - more reliable than form submit
  const response = await page.request.post('/api/cases', {
    data: {
      patientName: data.patientName,
      patientAge: data.patientAge,
      patientGender: data.patientGender,
      nextOfKin: data.nextOfKin,
      nextOfKinRelation: data.nextOfKinRelation,
      hospitalName: data.hospitalName,
      hospitalType: data.hospitalType,
      hospitalCity: data.hospitalCity,
      hospitalState: data.hospitalState,
      negligenceType: data.negligenceType,
      severity: data.severity,
      incidentDate: data.incidentDate,
      incidentDescription: data.incidentDescription,
      claimAmount: data.claimAmount,
      treatingDoctorName: data.treatingDoctorName,
      treatingDoctorRegistration: data.treatingDoctorRegistration,
    },
  });

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`Case creation failed: ${error.error?.message || response.statusText()}`);
  }

  const result = await response.json();
  const caseId = result.data?.id;
  if (!caseId) throw new Error('No case ID returned');

  // Navigate to the case detail page
  await page.goto(`/dashboard/cases/${caseId}`);
  await expect(page).toHaveURL(/\/dashboard\/cases\/[a-f0-9-]+/);

  return caseId;
}

async function openCase(page: Page, caseId: string) {
  await page.goto(`/dashboard/cases/${caseId}`);
  await expect(page).toHaveURL(/\/dashboard\/cases\/[a-f0-9-]+/);
  return caseId;
}

async function uploadDocument(page: Page, filePath: string) {
  await page.click('button:has-text("Evidence")');
  const fileInput = page.locator('#evidence-file');
  await fileInput.setInputFiles(filePath);
  await expect(page.locator('button:has-text("Upload evidence")')).toBeEnabled({ timeout: 5000 });
  await page.click('button:has-text("Upload evidence")');
  await expect(page.locator('text=Evidence uploaded')).toBeVisible({ timeout: 120000 });
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
  const docRow = page.locator('p.truncate', { hasText: fileName }).first();
  await expect(docRow).toBeVisible({ timeout: 30000 });
}

test.describe('Medilex E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Authentication flow - login and session', async ({ page }) => {
    await login(page);

    // Verify we're on dashboard
    await expect(page).toHaveURL('/dashboard');

    // Refresh should maintain session
    await page.reload();
    await expect(page).toHaveURL('/dashboard');
  });

  test('Case creation with validation', async ({ page }) => {
    await login(page);

    // Test API validation
    const response = await page.request.post('/api/cases', {
      data: {},
    });
    expect(response.ok()).toBeFalsy();
    const error = await response.json();
    expect(error.error?.code).toBe('VALIDATION_ERROR');

    // Create valid case via API
    await createCase(page);
  });

  test('Document upload with OCR processing', async ({ page }) => {
    await login(page);
    const caseId = await createCase(page);
    await openCase(page, caseId);

    const testPdf = 'tests/fixtures/test-document.pdf';
    await uploadDocument(page, testPdf);

    const docRow = page.locator('p.truncate', { hasText: 'test-document.pdf' }).locator('../..');
    const statusBadge = docRow.locator('span.inline-flex', { hasText: /completed/i });
    await expect(statusBadge).toBeVisible({ timeout: 120000 });
  });

  test('AI Analysis - Case Strength', async ({ page }) => {
    await login(page);
    const caseId = await createCase(page);
    await openCase(page, caseId);

    await page.click('button:has-text("Analysis")');
    await page.waitForSelector('button:has-text("Run assessment"), button:has-text("Refresh assessment")', { timeout: 10000 });
    await page.click('button:has-text("Run assessment"), button:has-text("Refresh assessment")');

    await expect(page.locator('text=Strength snapshot')).toBeVisible({ timeout: 120000 });

    const scoreElement = page.locator('p.text-4xl.font-semibold').first();
    await expect(scoreElement).toBeVisible();
    const score = await scoreElement.textContent();
    expect(Number(score)).toBeGreaterThan(0);
    expect(Number(score)).toBeLessThanOrEqual(100);
  });

  test('AI Analysis - Compensation Estimate', async ({ page }) => {
    await login(page);
    const caseId = await createCase(page);
    await openCase(page, caseId);

    await page.click('button:has-text("Analysis")');
    await page.waitForSelector('button:has-text("Estimate compensation")', { timeout: 10000 });
    await page.click('button:has-text("Estimate compensation")');

    await expect(page.locator('h2:has-text("Compensation estimate")')).toBeVisible({ timeout: 120000 });

    const midpointLabel = page.locator('p.uppercase', { hasText: 'midpoint' }).first();
    await expect(midpointLabel).toBeVisible();
    const midpointValue = midpointLabel.locator('..').locator('p.font-serif').first();
    await expect(midpointValue).toBeVisible();
    const text = await midpointValue.textContent();
    expect(text).toBeTruthy();
  });

  test('ODR - Readiness checklist', async ({ page }) => {
    await login(page);
    const caseId = await createCase(page);
    await openCase(page, caseId);

    await page.click('button:has-text("ODR")');
    await expect(page.locator('text=ODR readiness')).toBeVisible({ timeout: 10000 });

    const counter = page.locator('text=/\\d of 4 readiness checks complete/').first();
    await expect(counter).toContainText('0 of 4');

    await page.click('button:has-text("Verify intake facts and client chronology")');
    await expect(counter).toContainText('1 of 4');

    await page.click('button:has-text("Complete the evidence bundle")');
    await expect(counter).toContainText('2 of 4');
  });
});