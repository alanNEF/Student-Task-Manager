import { expect, test } from '@playwright/test';

test('persists dark mode across reloads and applies it to settings and task dialogs', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.sidebar')).toHaveCSS(
    'background-color',
    'rgb(17, 28, 46)',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Switch to light mode' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .locator('.topbar')
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await expect(page.locator('.settings-section').first()).toHaveCSS(
    'background-color',
    'rgb(24, 34, 53)',
  );
  await page.getByRole('button', { name: 'Back to board' }).click();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS(
    'background-color',
    'rgb(24, 34, 53)',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('follows device appearance until the student chooses a theme', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme toggle remains usable on mobile when local storage is blocked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('serves a blue graduation-cap favicon and uses blue primary accents', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  );
  const icon = await request.get('/favicon.svg');
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain('#2563eb');
  await expect(
    page.getByRole('button', { name: 'New task', exact: true }),
  ).toHaveCSS('background-color', 'rgb(37, 99, 235)');
  await expect(
    page.getByRole('region', { name: 'Done column' }).locator('.column-dot'),
  ).toHaveCSS('background-color', 'rgb(37, 99, 235)');
});
