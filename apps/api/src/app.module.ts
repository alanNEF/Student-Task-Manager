import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { API_CONFIG, loadApiConfig } from './config';
import { HealthController } from './health.controller';
import { SupabaseService } from './supabase.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  controllers: [HealthController, WorkspaceController],
  providers: [
    { provide: API_CONFIG, useFactory: loadApiConfig },
    SupabaseService,
    AuthGuard,
    WorkspaceService,
  ],
})
export class AppModule {}
