import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationTemplateStatus } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { CreateNotificationTemplateDto, ScheduleNotificationTemplateDto } from './dto/notification-template.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationService) {}

  list(userId: string) {
    return this.prisma.notificationTemplate.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }

  create(userId: string, data: CreateNotificationTemplateDto) {
    if (data.channel !== NotificationChannel.IN_APP && data.channel !== NotificationChannel.WHATSAPP) throw new BadRequestException('Only IN_APP and WHATSAPP templates are supported');
    if (data.channel === NotificationChannel.WHATSAPP && !data.providerTemplateName) throw new BadRequestException('WhatsApp requires an approved provider template name');
    return this.prisma.notificationTemplate.create({ data: { userId, name: data.name.trim(), channel: data.channel, message: data.message.trim(), providerTemplateName: data.providerTemplateName?.trim(), languageCode: data.languageCode ?? 'en_US' } });
  }

  async schedule(user: { id: string; companyId: string }, templateId: string, data: ScheduleNotificationTemplateDto) {
    const template = await this.prisma.notificationTemplate.findFirst({ where: { id: templateId, userId: user.id, status: NotificationTemplateStatus.ACTIVE } });
    if (!template) throw new NotFoundException('Notification template not found');
    const scheduledFor = new Date(data.scheduledFor);
    if (scheduledFor.getTime() <= Date.now()) throw new BadRequestException('scheduledFor must be in the future');
    if (data.shopId && !(await this.prisma.shop.findFirst({ where: { id: data.shopId, companyId: user.companyId }, select: { id: true } }))) throw new NotFoundException('Shop not found');
    return this.notifications.createForUser({ userId: user.id, shopId: data.shopId, type: 'GENERIC', message: template.message, templateName: template.providerTemplateName ?? template.name, languageCode: template.languageCode, bodyParameters: data.bodyParameters, channels: [template.channel], scheduledFor, metadata: { templateId: template.id } });
  }
}
