import { expect, test, type Page } from '@playwright/test';

async function openTask(page: Page, title: string) {
  await page
    .getByRole('button', { name: `Open task: ${title}`, exact: true })
    .click();
  return page.getByRole('dialog');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'My board', exact: true }),
  ).toBeVisible();
});

test('creates, edits, completes, persists, and deletes a task with optional fields and markdown', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  let editor = page.getByRole('dialog');
  await editor.getByLabel('Task title').fill('Write the research proposal');
  await editor
    .getByLabel('Description', { exact: true })
    .fill('## Proposal plan\n\nWork **carefully**.\n\n- Read the sources');
  await editor.getByLabel('Estimated hours').fill('2.5');
  await editor.getByLabel('Due date').fill('2099-12-31');
  await editor.getByRole('checkbox', { name: 'Class', exact: true }).check();
  await editor.getByRole('checkbox', { name: 'Personal', exact: true }).check();
  await editor.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(
    editor.getByRole('heading', { name: 'Proposal plan' }),
  ).toBeVisible();
  await expect(editor.locator('strong')).toHaveText('carefully');
  await editor
    .getByRole('button', { name: 'Create task', exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const card = page.getByRole('button', {
    name: 'Open task: Write the research proposal',
    exact: true,
  });
  await expect(
    page.getByRole('region', { name: 'To-Do column' }).getByRole('button', {
      name: 'Open task: Write the research proposal',
      exact: true,
    }),
  ).toBeVisible();
  await expect(card).toContainText('2.5h');
  await page.reload();
  await expect(card).toBeVisible();

  editor = await openTask(page, 'Write the research proposal');
  await expect(editor.getByLabel('Description', { exact: true })).toHaveValue(
    '## Proposal plan\n\nWork **carefully**.\n\n- Read the sources',
  );
  await expect(
    editor.getByRole('checkbox', { name: 'Class', exact: true }),
  ).toBeChecked();
  await expect(
    editor.getByRole('checkbox', { name: 'Personal', exact: true }),
  ).toBeChecked();
  await editor
    .getByLabel('Status', { exact: true })
    .selectOption({ label: 'Done' });
  await editor.getByLabel('Estimated hours').fill('');
  await editor.getByLabel('Due date').fill('');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('region', { name: 'Done column' }).getByRole('button', {
      name: 'Open task: Write the research proposal',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Workspace summary' })
      .getByText('33%', { exact: true }),
  ).toBeVisible();
  await expect(card).not.toContainText('2.5h');
  editor = await openTask(page, 'Write the research proposal');
  await expect(editor.getByLabel('Estimated hours')).toHaveValue('');
  await expect(editor.getByLabel('Due date')).toHaveValue('');
  await editor
    .getByRole('button', { name: 'Delete task', exact: true })
    .click();
  await expect(editor.getByRole('alert')).toContainText('Delete this task?');
  await editor.getByRole('button', { name: 'Keep task' }).click();
  await expect(editor).toBeVisible();
  await editor
    .getByRole('button', { name: 'Delete task', exact: true })
    .click();
  await editor.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(card).not.toBeVisible();
  await page.reload();
  await expect(card).not.toBeVisible();
});

test('cancel and escape leave the board unchanged and the new-task shortcut works', async ({
  page,
}) => {
  await page.keyboard.press('n');
  let editor = page.getByRole('dialog');
  await expect(editor).toBeVisible();
  await editor.getByLabel('Task title').fill('Unsaved task');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open task: Unsaved task' }),
  ).not.toBeVisible();
  editor = await openTask(page, 'Finish the calculus problem set');
  await editor.getByLabel('Task title').fill('Unsaved change');
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Open task: Finish the calculus problem set',
      exact: true,
    }),
  ).toBeVisible();
});

test('dragging a task to another column updates and persists its status', async ({
  page,
}) => {
  const title = 'Finish the calculus problem set';
  const handle = page.getByRole('button', {
    name: `Move task: ${title}`,
    exact: true,
  });
  const destination = page.getByRole('region', { name: 'In-Progress column' });
  await handle.hover();
  const sourceBox = await handle.boundingBox();
  const targetBox = await destination.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + 120,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect(
    destination.getByRole('button', {
      name: `Open task: ${title}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    destination.getByRole('button', {
      name: `Open task: ${title}`,
      exact: true,
    }),
  ).toBeVisible();
});

test('works on a narrow screen without page-level horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'New task', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Task title').fill('Mobile task');
  await editor
    .getByRole('button', { name: 'Create task', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Open task: Mobile task', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('filters by tag and search, then recovers from an empty result', async ({
  page,
}) => {
  await page
    .getByRole('combobox', { name: 'Filter by tag', exact: true })
    .selectOption({ label: 'Job Search' });
  await expect(
    page.getByRole('button', {
      name: 'Open task: Apply to the summer design internship',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Open task: Finish the calculus problem set',
      exact: true,
    }),
  ).not.toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search tasks', exact: true })
    .fill('résumé');
  await expect(
    page.getByRole('button', {
      name: 'Open task: Update my résumé',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Open task: Apply to the summer design internship',
      exact: true,
    }),
  ).not.toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search tasks', exact: true })
    .fill('no matching assignment');
  await expect(
    page.getByText('No tasks match these filters.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Open task: Finish the calculus problem set',
      exact: true,
    }),
  ).toBeVisible();
});

test('moves a task into an empty custom column using only the keyboard', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Settings', exact: true })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Create column', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Column name').fill('Review');
  await dialog
    .getByRole('button', { name: 'Create column', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to board', exact: true })
    .click();
  const handle = page.getByRole('button', {
    name: 'Move task: Finish the calculus problem set',
    exact: true,
  });
  await handle.press('Space');
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('region', { name: 'Review column' }).getByRole('button', {
      name: 'Open task: Finish the calculus problem set',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Review column' }).getByRole('button', {
      name: 'Open task: Finish the calculus problem set',
      exact: true,
    }),
  ).toBeVisible();
});
