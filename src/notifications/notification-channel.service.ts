import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel } from 'generated/prisma/client';
import { NotificationChannelRepository } from './notification-channel.repository';
import { NotificationCredentialsService } from './notification-credentials.service';
import { NotificationService } from './notification.service';
import { TestNotificationChannelDto, UpdateNotificationChannelDto } from './dto/notification-channel.dto';

type WhatsAppConfiguration = { phoneNumberId?: string; apiVersion?: string };

@Injectable()
export class NotificationChannelService {
  constructor(
    private readonly repository: NotificationChannelRepository,
    private readonly credentials: NotificationCredentialsService,
    private readonly notifications: NotificationService,
  ) {}

  async list(userId: string) {
    const channels = await this.repository.list(userId);
    const byChannel = new Map(channels.map((item) => [item.channel, item]));
    return [NotificationChannel.IN_APP, NotificationChannel.WHATSAPP, NotificationChannel.EMAIL].map((channel) => {
      const item = byChannel.get(channel);
      const configuration = (item?.configuration ?? {}) as WhatsAppConfiguration;
      return {
        channel,
        enabled: item?.enabled ?? channel === NotificationChannel.IN_APP,
        destination: item?.destination ?? null,
        phoneNumberId: configuration.phoneNumberId ?? null,
        apiVersion: configuration.apiVersion ?? 'v25.0',
        hasCredentials: Boolean(item?.credentialsCiphertext),
        lastTestedAt: item?.lastTestedAt ?? null,
        lastTestStatus: item?.lastTestStatus ?? null,
      };
    });
  }

  async update(userId: string, channel: NotificationChannel, data: UpdateNotificationChannelDto) {
    if (channel === NotificationChannel.IN_APP) {
      await this.repository.upsert(userId, channel, { enabled: data.enabled });
      return this.list(userId);
    }
    if (channel === NotificationChannel.EMAIL) {
      const destination = data.destination?.trim() || (await this.repository.find(userId, channel))?.destination;
      if (data.enabled && (!destination || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)))
        throw new BadRequestException('A valid destination email address is required to enable email');
      await this.repository.upsert(userId, channel, { enabled: data.enabled, destination: destination ?? null });
      return this.list(userId);
    }
    const existing = await this.repository.find(userId, channel);
    const current = (existing?.configuration ?? {}) as WhatsAppConfiguration;
    const destination = data.destination ?? existing?.destination;
    const phoneNumberId = data.phoneNumberId ?? current.phoneNumberId;
    if (data.enabled && (!destination || !phoneNumberId || (!data.accessToken && !existing?.credentialsCiphertext))) {
      throw new BadRequestException('Destination, phone number ID, and access token are required to enable WhatsApp');
    }
    await this.repository.upsert(userId, channel, {
      enabled: data.enabled,
      destination: destination ?? null,
      ...(data.accessToken
        ? { credentialsCiphertext: this.credentials.encrypt({ accessToken: data.accessToken }) }
        : {}),
      configuration: {
        phoneNumberId: phoneNumberId ?? '',
        apiVersion: data.apiVersion ?? current.apiVersion ?? 'v25.0',
      },
    });
    return this.list(userId);
  }

  async test(userId: string, channel: NotificationChannel, data: TestNotificationChannelDto) {
    const configured = await this.repository.find(userId, channel);
    if (!configured?.enabled) throw new BadRequestException(`${channel} is not enabled`);
    const notification = await this.notifications.createForUser({
      userId,
      type: 'GENERIC',
      message: `Test ${channel} notification`,
      channels: [channel],
      templateName: data.templateName,
      languageCode: data.languageCode,
      bodyParameters: data.bodyParameters,
      metadata: channel === NotificationChannel.EMAIL
        ? { test: true, subject: 'Dantech notification test', html: '<p>Your Dantech email notification channel is working.</p>' }
        : { test: true },
    });
    const delivery = notification.deliveries[0];
    if (!delivery) throw new NotFoundException('Test delivery could not be created');
    await this.repository.markTest(userId, channel, delivery.status);
    return { notificationId: notification.id, deliveryId: delivery.id, status: delivery.status };
  }
}
