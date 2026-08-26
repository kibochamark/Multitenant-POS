import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { NotificationProcessor } from './notification.processor';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationService } from './notification.service';
import { NOTIFICATION_QUEUE } from './notifications.constants';
import { LogNotificationProvider } from './providers/log.provider';
import { SmsProvider } from './providers/sms.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { InAppNotificationController } from './in-app-notification.controller';
import { InAppNotificationService } from './in-app-notification.service';
import { InAppNotificationRepository } from './in-app-notification.repository';
import { NotificationChannelController } from './notification-channel.controller';
import { NotificationChannelRepository } from './notification-channel.repository';
import { NotificationChannelService } from './notification-channel.service';
import { NotificationCredentialsService } from './notification-credentials.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationTemplateController } from './notification-template.controller';
import { NotificationTemplateService } from './notification-template.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
          port: Number(config.get<string>('REDIS_PORT') ?? 6379),
          ...(config.get<string>('REDIS_PASSWORD')
            ? { password: config.get<string>('REDIS_PASSWORD') }
            : {}),
          maxRetriesPerRequest: 3,
        },
      }),
    }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [InAppNotificationController, NotificationChannelController, NotificationTemplateController],
  providers: [
    NotificationService,
    NotificationQueueService,
    NotificationDeliveryRepository,
    NotificationDeliveryService,
    NotificationCredentialsService,
    NotificationChannelRepository,
    NotificationChannelService,
    NotificationTemplateService,
    NotificationProcessor,
    WhatsAppProvider,
    LogNotificationProvider,
    SmsProvider,
    InAppNotificationService,
    InAppNotificationRepository,
  ],
  exports: [NotificationService, NotificationQueueService],
})
export class NotificationsModule {}
