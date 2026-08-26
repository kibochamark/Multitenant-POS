import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ScheduledJobsRepository } from './scheduled-jobs.repository';
import { ScheduledJobsService } from './scheduled-jobs.service';

@Module({ imports: [NotificationsModule], providers: [ScheduledJobsRepository, ScheduledJobsService] })
export class SchedulingModule {}
