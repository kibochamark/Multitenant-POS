import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class InAppNotificationRepository {
  private readonly logger = new Logger(InAppNotificationRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async list(shopId: string, userId: string, limit: number, cursor?: string) {
    this.logger.log(`Listing in-app notifications for user ${userId}`);
    const where = {
      userId,
      notification: { OR: [{ shopId }, { shopId: null }] },
    };
    const [rows, unreadCount] = await this.prisma.$transaction([
      this.prisma.notificationRecipient.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { notification: true },
      }),
      this.prisma.notificationRecipient.count({
        where: { ...where, readAt: null },
      }),
    ]);
    const hasNextPage = rows.length > limit;
    const items = rows.slice(0, limit);
    return {
      items: items.map((row) => ({
        id: row.notification.id,
        recipientId: row.id,
        type: row.notification.type,
        message: row.notification.message,
        metadata: row.notification.metadata,
        createdAt: row.notification.createdAt,
        readAt: row.readAt,
      })),
      unreadCount,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  markRead(shopId: string, notificationId: string, userId: string) {
    this.logger.log(`Marking notification ${notificationId} read`);
    return this.prisma.notificationRecipient.updateMany({
      where: {
        userId,
        notificationId,
        notification: { OR: [{ shopId }, { shopId: null }] },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  markAllRead(shopId: string, userId: string) {
    this.logger.log(`Marking all notifications read for user ${userId}`);
    return this.prisma.notificationRecipient.updateMany({
      where: {
        userId,
        notification: { OR: [{ shopId }, { shopId: null }] },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }
}
