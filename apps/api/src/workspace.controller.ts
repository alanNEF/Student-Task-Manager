import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  BoardColumn,
  Tag,
  Task,
  Workspace,
} from '@student-task-manager/shared';
import { AuthGuard, CurrentSession } from './auth.guard';
import type { AuthSession } from './supabase.service';
import { uuid, validateColumn, validateTag, validateTask } from './validation';
import { WorkspaceService } from './workspace.service';

@Controller()
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('workspace')
  workspace(@CurrentSession() session: AuthSession): Promise<Workspace> {
    return this.workspaceService.workspace(session);
  }

  @Post('tasks')
  createTask(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<Task> {
    return this.workspaceService.createTask(session, validateTask(body));
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Task> {
    return this.workspaceService.updateTask(
      session,
      uuid(id),
      validateTask(body, true),
    );
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  deleteTask(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ): Promise<void> {
    return this.workspaceService.deleteTask(session, uuid(id));
  }

  @Post('tags')
  createTag(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<Tag> {
    return this.workspaceService.createTag(session, validateTag(body));
  }

  @Patch('tags/:id')
  updateTag(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Tag> {
    return this.workspaceService.updateTag(
      session,
      uuid(id),
      validateTag(body, true),
    );
  }

  @Delete('tags/:id')
  @HttpCode(204)
  deleteTag(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ): Promise<void> {
    return this.workspaceService.deleteTag(session, uuid(id));
  }

  @Post('columns')
  createColumn(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<BoardColumn> {
    return this.workspaceService.createColumn(session, validateColumn(body));
  }

  @Patch('columns/:id')
  updateColumn(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<BoardColumn> {
    return this.workspaceService.updateColumn(
      session,
      uuid(id),
      validateColumn(body, true),
    );
  }

  @Delete('columns/:id')
  @HttpCode(204)
  deleteColumn(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Query('moveTo') moveTo: unknown,
  ): Promise<void> {
    const columnId = uuid(id);
    const destination = uuid(moveTo, 'moveTo');
    if (columnId === destination)
      throw new BadRequestException('Move tasks to a different column.');
    return this.workspaceService.deleteColumn(session, columnId, destination);
  }
}
