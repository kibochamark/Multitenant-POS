import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationDeliveryStatus } from 'generated/prisma/client';
import { UnrecoverableError } from 'bullmq';
import { NotificationCredentialsService } from './notification-credentials.service';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { LogNotificationProvider } from './providers/log.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { PermanentDeliveryError, WhatsAppCredentials } from './types/notification-provider.types';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly credentials: NotificationCredentialsService,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppProvider,
    private readonly logProvider: LogNotificationProvider,
  ) {}

  async deliver(deliveryId: string) {
    const delivery = await this.repository.find(deliveryId);
    console.log(delivery, "reached")
    if (!delivery || delivery.status === NotificationDeliveryStatus.SENT || delivery.status === NotificationDeliveryStatus.SKIPPED) return;
    await this.repository.markProcessing(delivery.id);
    try {
      const result = delivery.channel === NotificationChannel.IN_APP
        ? await this.deliverInApp(delivery)
        : delivery.channel === NotificationChannel.WHATSAPP
          ? await this.deliverWhatsApp(delivery)
          : await this.repository.markSkipped(delivery.id, `${delivery.channel} is not supported`);
      await this.recordTestStatus(delivery, NotificationDeliveryStatus.SENT);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown delivery failure';
      await this.repository.markFailed(delivery.id, message);
      await this.recordTestStatus(delivery, NotificationDeliveryStatus.FAILED);
      if (error instanceof PermanentDeliveryError) throw new UnrecoverableError(message);
      throw error;
    }
  }

  private recordTestStatus(delivery: Awaited<ReturnType<NotificationDeliveryRepository['find']>> & {}, status: NotificationDeliveryStatus) {
    const metadata = (delivery.notification.metadata ?? {}) as { test?: boolean };
    return metadata.test ? this.repository.markChannelTest(delivery.userId, delivery.channel, status) : Promise.resolve();
  }

  private deliverInApp(delivery: Awaited<ReturnType<NotificationDeliveryRepository['find']>> & {}) {
    return this.repository.publishInApp(delivery.id, delivery.notificationId, delivery.userId);
  }

  private async deliverWhatsApp(delivery: Awaited<ReturnType<NotificationDeliveryRepository['find']>> & {}) {
    const channel = delivery.user.notificationChannels.find(({ channel }) => channel === NotificationChannel.WHATSAPP);
    if (!channel?.enabled) return this.repository.markSkipped(delivery.id, 'WhatsApp is disabled');
    if (!channel.credentialsCiphertext) throw new PermanentDeliveryError('WhatsApp credentials are missing');
    const configuration = (channel.configuration ?? {}) as { phoneNumberId?: string; apiVersion?: string };
    if (!configuration.phoneNumberId) throw new PermanentDeliveryError('WhatsApp phone number ID is missing');
    const destination = delivery.destination ?? channel.destination ?? delivery.user.phone;
    if (!destination) throw new PermanentDeliveryError('WhatsApp destination is missing');
    const metadata = (delivery.notification.metadata ?? {}) as { templateName?: string; languageCode?: string; bodyParameters?: string[] };
    if (!metadata.templateName) throw new PermanentDeliveryError('WhatsApp template name is missing');
    const request = { to: destination, templateName: metadata.templateName, languageCode: metadata.languageCode, bodyParameters: metadata.bodyParameters ?? [] };
    const receipt = this.config.get('NOTIFICATION_TRANSPORT') === 'whatsapp'
      ? await this.whatsapp.sendTemplate(request, {
          ...this.credentials.decrypt<{ accessToken: string }>(channel.credentialsCiphertext),
          phoneNumberId: configuration.phoneNumberId,
          apiVersion: configuration.apiVersion,
        } satisfies WhatsAppCredentials)
      : await this.logProvider.sendWhatsApp(request);
    await this.repository.markSent(delivery.id, receipt.messageId);
    this.logger.log(`Delivery ${delivery.id} sent by ${receipt.provider}`);
    return receipt;
  }
}
