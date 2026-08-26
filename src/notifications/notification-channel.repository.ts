import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationDeliveryStatus, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class NotificationChannelRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userNotificationChannel.findMany({
      where: { userId, channel: { in: [NotificationChannel.IN_APP, NotificationChannel.WHATSAPP] } },
      orderBy: { channel: 'asc' },
    });
  }

  find(userId: string, channel: NotificationChannel) {
    return this.prisma.userNotificationChannel.findUnique({
      where: { userId_channel: { userId, channel } },
    });
  }

  upsert(userId: string, channel: NotificationChannel, data: {
    enabled: boolean;
    destination?: string | null;
    credentialsCiphertext?: string;
    configuration?: Prisma.InputJsonObject;
  }) {
    return this.prisma.userNotificationChannel.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel, ...data },
      update: data,
    });
  }

  markTest(userId: string, channel: NotificationChannel, status: NotificationDeliveryStatus) {
    return this.prisma.userNotificationChannel.update({
      where: { userId_channel: { userId, channel } },
      data: { lastTestedAt: new Date(), lastTestStatus: status },
    });
  }
}
