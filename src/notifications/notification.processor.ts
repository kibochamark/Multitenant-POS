import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationQueueService } from './notification-queue.service';
import {
  NOTIFICATION_QUEUE,
  RECOVER_OUTBOX_JOB,
  SEND_DELIVERY_JOB,
} from './notifications.constants';

@Injectable()
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly queue: NotificationQueueService,
    private readonly deliveries: NotificationDeliveryService,
  ) {
    super();
  }

  async process(job: Job<{ deliveryId?: string }>) {
    if (job.name === RECOVER_OUTBOX_JOB) return this.queue.recover();
    if (job.name !== SEND_DELIVERY_JOB || !job.data.deliveryId) {
      throw new UnrecoverableError(`Unknown notification job ${job.name}`);
    }
    return this.deliveries.deliver(job.data.deliveryId);
  }
}
