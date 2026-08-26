import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  private readonly logger = new Logger(SettingsRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  get(shopId: string, userId: string) {
    this.logger.log(`Loading settings for user ${userId} and shop ${shopId}`);
    return Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          defaultOwner: true,
          notificationPreference: true,
        },
      }),
      this.prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: {
          id: true,
          name: true,
          vatPct: true,
          defaultMinMarginPct: true,
          globalDiscountPct: true,
          company: {
            select: {
              id: true,
              name: true,
              vatPct: true,
              defaultMinMarginPct: true,
              globalDiscountPct: true,
            },
          },
        },
      }),
    ]);
  }

  getForNotifications(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        phone: true,
        notificationPreference: {
          select: { whatsappOptInAt: true },
        },
      },
    });
  }

  updateProfile(
    userId: string,
    data: { name?: string; phone?: string | null },
  ) {
    this.logger.log(`Updating profile settings for user ${userId}`);
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true },
    });
  }

  updateNotificationPreference(
    userId: string,
    data: {
      enabled: boolean;
      inAppEnabled: boolean;
      whatsappEnabled: boolean;
      smsEnabled: boolean;
      whatsappOptInAt?: Date | null;
    },
  ) {
    this.logger.log(`Updating notification preferences for user ${userId}`);
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  updateCompany(companyId: string, data: Prisma.CompanyUpdateInput) {
    this.logger.log(`Updating company settings for company ${companyId}`);
    return this.prisma.company.update({ where: { id: companyId }, data });
  }

  updateShop(shopId: string, data: Prisma.ShopUpdateInput) {
    this.logger.log(`Updating shop settings for shop ${shopId}`);
    return this.prisma.shop.update({ where: { id: shopId }, data });
  }
}
