import { Injectable, NotFoundException } from '@nestjs/common';
import { InAppNotificationRepository } from './in-app-notification.repository';

@Injectable()
export class InAppNotificationService {
  constructor(private readonly repository: InAppNotificationRepository) {}

  list(shopId: string, userId: string, requestedLimit?: string, cursor?: string) {
    const parsed = Number(requestedLimit ?? 20);
    const limit = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20;
    return this.repository.list(shopId, userId, limit, cursor);
  }

  async markRead(shopId: string, notificationId: string, userId: string) {
    const result = await this.repository.markRead(shopId, notificationId, userId);
    if (!result.count) throw new NotFoundException('Notification not found');
    return { notificationId, read: true };
  }

  async markAllRead(shopId: string, userId: string) {
    const result = await this.repository.markAllRead(shopId, userId);
    return { updatedCount: result.count };
  }
}
