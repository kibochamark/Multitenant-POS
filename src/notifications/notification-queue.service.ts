import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  NOTIFICATION_QUEUE,
  RECOVER_OUTBOX_JOB,
  SEND_DELIVERY_JOB,
} from './notifications.constants';
import { NotificationDeliveryRepository } from './notification-delivery.repository';

@Injectable()
export class NotificationQueueService implements OnModuleInit {
  private readonly logger = new Logger(NotificationQueueService.name);
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly repository: NotificationDeliveryRepository,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'notification-outbox-recovery',
      { every: 60_000 },
      { name: RECOVER_OUTBOX_JOB, data: {}, opts: { removeOnComplete: true } },
    );
  }

  async enqueue(deliveryId: string, scheduledFor?: Date | null) {
    // A deterministic job ID deduplicates repeated enqueue attempts from the
    // immediate producer and the recovery job.
    const delay = scheduledFor ? Math.max(scheduledFor.getTime() - Date.now(), 0) : 0;
    await this.queue.add(
      SEND_DELIVERY_JOB,
      { deliveryId },
      {
        jobId: deliveryId,
        delay,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
    await this.repository.markQueued(deliveryId);
  }

  async recover() {
    const pending = await this.repository.findRecoverable();
    this.logger.log(`Recovering ${pending.length} notification deliveries`);
    await Promise.allSettled(pending.map(({ id }) => this.enqueue(id)));
  }
}
