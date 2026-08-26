import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationType, Prisma } from 'generated/prisma/client';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly queue: NotificationQueueService,
  ) {}

  async create(input: {
    dedupeKey?: string;
    shopId?: string;
    type: NotificationType;
    message: string;
    templateName: string;
    bodyParameters?: string[];
    metadata?: Prisma.InputJsonObject;
    recipients: Array<{ userId: string; phone?: string | null }>;
  }) {
    this.logger.log(
      `Creating ${input.type} notification for ${input.recipients.length} recipients`,
    );
    const notifications = await Promise.all(input.recipients.map((recipient) =>
      this.createForUser({
        ...input,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${recipient.userId}` : undefined,
        userId: recipient.userId,
      }),
    ));
    return notifications[0] ?? null;
  }

  async createForUser(input: {
    userId: string;
    dedupeKey?: string;
    shopId?: string;
    type: NotificationType;
    message: string;
    templateName: string;
    languageCode?: string;
    bodyParameters?: string[];
    metadata?: Prisma.InputJsonObject;
    channels?: NotificationChannel[];
    scheduledFor?: Date;
  }) {
    const configured = await this.repository.enabledChannels(input.userId);
    const requested = input.channels ?? configured.map(({ channel }) => channel);
    const enabled = configured.filter(({ channel }) => requested.includes(channel));
    const channels = enabled.length || input.channels
      ? enabled
      : [{ channel: NotificationChannel.IN_APP, destination: null }];

      
    const result = await this.repository.createNotificationWithDeliveries({
      dedupeKey: input.dedupeKey,
      shopId: input.shopId,
      type: input.type,
      message: input.message,
      metadata: {
        ...(input.metadata ?? {}),
        templateName: input.templateName,
        languageCode: input.languageCode ?? 'en_US',
        bodyParameters: input.bodyParameters ?? [],
      },
      deliveries: channels.map((channel) => ({
        userId: input.userId,
        channel: channel.channel,
        destination: channel.destination,
        scheduledFor: input.scheduledFor,
      })),
    });
    await Promise.allSettled(result.deliveries.map(({ id, scheduledFor }) =>
      this.queue.enqueue(id, scheduledFor),
    ));
    return { ...result.notification, deliveries: result.deliveries };
  }
}
