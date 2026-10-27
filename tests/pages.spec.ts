import { expect, test } from '@playwright/test';
test('exported Pages assets, lazy routes, invite and responsive login', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && /\.(js|ttf|png|ico)$/.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/mesa-rpg/?code=ABCDEFGH');
  await expect(page.getByText(/Você recebeu um convite/)).toBeVisible();
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.reload();
  await expect(page.getByText(/Você recebeu um convite/)).toBeVisible();
  await page.goto('/mesa-rpg/join?code=ABCDEFGH');
  await expect(page.getByText(/Você recebeu um convite/)).toBeVisible();
  await expect(page).toHaveURL(/\/mesa-rpg\/\?code=ABCDEFGH/);
  expect(errors).toEqual([]);
});
