import { BadRequestException } from '@nestjs/common';
import {
  isValidDateOnly,
  type CreateColumnInput,
  type CreateTagInput,
  type CreateTaskInput,
  type UpdateColumnInput,
  type UpdateTagInput,
  type UpdateTaskInput,
} from '@student-task-manager/shared';

type JsonObject = Record<string, unknown>;

function invalid(message: string): never {
  throw new BadRequestException(message);
}

function object(
  value: unknown,
  allowedKeys: readonly string[],
  partial: boolean,
): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Request body must be an object.');
  const result = value as JsonObject;
  for (const key of Object.keys(result)) {
    if (!allowedKeys.includes(key)) invalid(`Unknown field: ${key}.`);
  }
  if (partial && Object.keys(result).length === 0)
    invalid('Provide at least one field to update.');
  return result;
}

function text(
  value: unknown,
  field: string,
  maximum: number,
  allowEmpty = false,
): string {
  if (typeof value !== 'string') invalid(`${field} must be text.`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maximum) {
    invalid(
      `${field} must be ${allowEmpty ? 'at most' : 'between 1 and'} ${maximum} characters.`,
    );
  }
  return normalized;
}

function description(value: unknown): string {
  if (typeof value !== 'string' || value.length > 20_000)
    invalid('description must be text with at most 20000 characters.');
  // Leading indentation and blank lines are meaningful in Markdown.
  return value;
}

export function uuid(value: unknown, field = 'id'): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  ) {
    invalid(`${field} must be a valid UUID.`);
  }
  return value.trim().toLowerCase();
}

function color(value: unknown): string {
  const normalized = text(value, 'color', 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized))
    invalid('color must be a six-digit hex color, such as #8b5cf6.');
  return normalized.toLowerCase();
}

function duration(value: unknown): number | null {
  if (value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1000
  ) {
    invalid(
      'duration_hours must be a number greater than 0 and at most 1000, or null.',
    );
  }
  return value;
}

function dueDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !isValidDateOnly(value.trim())) {
    invalid('due_date must be a real date in YYYY-MM-DD format, or null.');
  }
  return value.trim();
}

function tagIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100)
    invalid('tag_ids must contain at most 100 UUIDs.');
  return [...new Set(value.map((id) => uuid(id, 'tag_ids')))];
}

const taskKeys = [
  'title',
  'description',
  'status_id',
  'duration_hours',
  'due_date',
  'tag_ids',
] as const;

export function validateTask(value: unknown, partial: true): UpdateTaskInput;
export function validateTask(value: unknown, partial?: false): CreateTaskInput;
export function validateTask(
  value: unknown,
  partial = false,
): CreateTaskInput | UpdateTaskInput {
  const input = object(value, taskKeys, partial);
  const result: UpdateTaskInput = {};
  if (!partial || 'title' in input)
    result.title = text(input.title, 'title', 200);
  if (!partial || 'status_id' in input)
    result.status_id = uuid(input.status_id, 'status_id');
  if ('description' in input)
    result.description = description(input.description);
  if ('duration_hours' in input)
    result.duration_hours = duration(input.duration_hours);
  if ('due_date' in input) result.due_date = dueDate(input.due_date);
  if ('tag_ids' in input) result.tag_ids = tagIds(input.tag_ids);
  return result;
}

const tagKeys = ['name', 'color'] as const;

export function validateTag(value: unknown, partial: true): UpdateTagInput;
export function validateTag(value: unknown, partial?: false): CreateTagInput;
export function validateTag(
  value: unknown,
  partial = false,
): CreateTagInput | UpdateTagInput {
  const input = object(value, tagKeys, partial);
  const result: UpdateTagInput = {};
  if (!partial || 'name' in input) result.name = text(input.name, 'name', 50);
  if (!partial || 'color' in input) result.color = color(input.color);
  return result;
}

const columnKeys = ['name', 'color', 'position', 'is_done'] as const;

export function validateColumn(
  value: unknown,
  partial: true,
): UpdateColumnInput;
export function validateColumn(
  value: unknown,
  partial?: false,
): CreateColumnInput;
export function validateColumn(
  value: unknown,
  partial = false,
): CreateColumnInput | UpdateColumnInput {
  const input = object(value, columnKeys, partial);
  const result: UpdateColumnInput = {};
  if (!partial || 'name' in input) result.name = text(input.name, 'name', 50);
  if (!partial || 'color' in input) result.color = color(input.color);
  if (!partial || 'position' in input) {
    if (
      typeof input.position !== 'number' ||
      !Number.isInteger(input.position) ||
      input.position < 0 ||
      input.position > 10_000
    ) {
      invalid('position must be an integer between 0 and 10000.');
    }
    result.position = input.position;
  }
  if ('is_done' in input) {
    if (typeof input.is_done !== 'boolean')
      invalid('is_done must be true or false.');
    result.is_done = input.is_done;
  }
  return result;
}
