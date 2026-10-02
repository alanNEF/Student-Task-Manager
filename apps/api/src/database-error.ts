import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

interface DatabaseError {
  code?: string;
}

// Database messages may contain SQL, table names, or raw values. Return stable safe errors instead.
export function throwDatabaseError(
  error: DatabaseError | null,
  resource = 'Item',
): void {
  if (!error) return;
  if (error.code === 'PGRST116' || error.code === 'P0002')
    throw new NotFoundException(`${resource} was not found.`);
  if (error.code === 'PGRST301' || error.code === 'PGRST302')
    throw new UnauthorizedException('Please sign in again.');
  if (
    [
      '22023',
      '22003',
      '22007',
      '22008',
      '22P02',
      '23502',
      '23503',
      '23505',
      '23514',
      'P0001',
      '42501',
    ].includes(error.code ?? '')
  ) {
    throw new BadRequestException(
      'The change is invalid. Check the values and make sure the selected items belong to your workspace.',
    );
  }
  throw new ServiceUnavailableException(
    'The data service is temporarily unavailable. Please try again.',
  );
}
