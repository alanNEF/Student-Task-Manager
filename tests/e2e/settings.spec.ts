import { expect, test } from '@playwright/test';

test('customizes tags and completed columns without losing their tasks', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Settings', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.account-details').getByText('Alex Morgan', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('.account-details')
      .getByText('alex@example.com', { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create tag', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tag name').fill('Research');
  await dialog.getByRole('button', { name: 'Create tag', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Edit tag Research', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tag name').fill('Capstone');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('button', { name: 'Edit tag Capstone', exact: true }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Create column', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Column name').fill('Review');
  await dialog
    .getByRole('switch', { name: 'Completed column', exact: true })
    .check();
  await dialog
    .getByRole('button', { name: 'Create column', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Edit column Review', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Column name').fill('Ready to submit');
  await expect(
    dialog.getByRole('switch', { name: 'Completed column', exact: true }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await page
    .getByRole('button', { name: 'Back to board', exact: true })
    .click();

  await page
    .getByRole('button', { name: 'Add task to Ready to submit', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task title').fill('Capstone submission');
  await dialog.getByRole('checkbox', { name: 'Capstone', exact: true }).check();
  await dialog
    .getByRole('button', { name: 'Create task', exact: true })
    .click();
  let card = page.getByRole('button', {
    name: 'Open task: Capstone submission',
    exact: true,
  });
  await expect(
    page
      .getByRole('region', { name: 'Ready to submit column' })
      .getByRole('button', {
        name: 'Open task: Capstone submission',
        exact: true,
      }),
  ).toBeVisible();
  await expect(card).toContainText('Capstone');

  await page
    .getByRole('button', { name: 'Settings', exact: true })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Delete tag Capstone', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Your tasks will be kept');
  await dialog.getByRole('button', { name: 'Delete tag', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit tag Capstone', exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Delete column Ready to submit', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Move tasks to')
    .selectOption({ label: 'In-Progress' });
  await dialog
    .getByRole('button', { name: 'Delete column', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Edit column Ready to submit',
      exact: true,
    }),
  ).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Back to board', exact: true })
    .click();
  card = page
    .getByRole('region', { name: 'In-Progress column' })
    .getByRole('button', {
      name: 'Open task: Capstone submission',
      exact: true,
    });
  await expect(card).toBeVisible();
  await expect(card.locator('.task-tag')).toHaveCount(0);
  await page.reload();
  await expect(card).toBeVisible();
});
