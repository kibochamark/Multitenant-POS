import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationDeliveryStatus, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class NotificationDeliveryRepository {
  private readonly logger = new Logger(NotificationDeliveryRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  enabledChannels(userId: string) {
    return this.prisma.userNotificationChannel.findMany({
      where: {
        userId,
        enabled: true,
        channel: { in: [NotificationChannel.IN_APP, NotificationChannel.WHATSAPP, NotificationChannel.EMAIL] },
      },
      select: { channel: true, destination: true },
    });
  }

  find(deliveryId: string) {
    return this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        notification: true,
        user: {
          select: {
            phone: true,
            notificationChannels: true,
          },
        },
      },
    });
  }

  markQueued(deliveryId: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: NotificationDeliveryStatus.QUEUED, queuedAt: new Date() },
    });
  }

  markProcessing(deliveryId: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
  }

  markSent(deliveryId: string, providerMessageId: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.SENT,
        providerMessageId,
        sentAt: new Date(),
        failedAt: null,
        lastError: null,
      },
    });
  }

  async publishInApp(deliveryId: string, notificationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.notificationRecipient.upsert({
        where: { notificationId_userId: { notificationId, userId } },
        create: { notificationId, userId },
        update: {},
      });
      return tx.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.SENT,
          providerMessageId: `in-app:${notificationId}`,
          sentAt: new Date(),
          failedAt: null,
          lastError: null,
        },
      });
    });
  }

  markFailed(deliveryId: string, error: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        failedAt: new Date(),
        lastError: error.slice(0, 1000),
      },
    });
  }

  markSkipped(deliveryId: string, reason: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.SKIPPED,
        lastError: reason.slice(0, 1000),
      },
    });
  }

  markChannelTest(userId: string, channel: NotificationChannel, status: NotificationDeliveryStatus) {
    return this.prisma.userNotificationChannel.updateMany({
      where: { userId, channel },
      data: { lastTestedAt: new Date(), lastTestStatus: status },
    });
  }

  findRecoverable(limit = 100) {
    const stale = new Date(Date.now() - 60_000);
    return this.prisma.notificationDelivery.findMany({
      where: {
        AND: [
          { OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
          { OR: [
            { status: NotificationDeliveryStatus.PENDING },
            {
              status: NotificationDeliveryStatus.QUEUED,
              queuedAt: { lt: stale },
            },
          ] },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
  }

  createNotificationWithDeliveries(input: {
    dedupeKey?: string;
    shopId?: string;
    type: Prisma.NotificationCreateInput['type'];
    message: string;
    metadata?: Prisma.InputJsonValue;
    deliveries: Array<{
      userId: string;
      channel: NotificationChannel;
      destination?: string | null;
      scheduledFor?: Date;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (input.dedupeKey) {
        const existing = await tx.notification.findFirst({
          where: { dedupeKey: input.dedupeKey },
          include: { deliveries: true },
        });
        if (existing) return { notification: existing, deliveries: existing.deliveries };
      }
      const notification = await tx.notification.create({
        data: {
          ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
          ...(input.shopId ? { shop: { connect: { id: input.shopId } } } : {}),
          type: input.type,
          message: input.message,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
      });
      const deliveries = await Promise.all(
        input.deliveries.map((delivery) =>
          tx.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              userId: delivery.userId,
              channel: delivery.channel,
              destination: delivery.destination ?? null,
              scheduledFor: delivery.scheduledFor ?? new Date(),
            },
          }),
        ),
      );
      return { notification, deliveries };
    });
  }
}
