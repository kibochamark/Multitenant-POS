import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DeliveryReceipt,
  WhatsAppTemplateRequest,
} from '../types/notification-provider.types';
import { maskPhoneNumber, normalizePhoneNumber } from '../utils/phone.utils';

@Injectable()
export class LogNotificationProvider {
  private readonly logger = new Logger(LogNotificationProvider.name);

  async sendWhatsApp(
    request: WhatsAppTemplateRequest,
  ): Promise<DeliveryReceipt> {
    const phone = normalizePhoneNumber(request.to);
    this.logger.log(
      `[LOCAL ONLY] WhatsApp ${request.templateName} -> ${maskPhoneNumber(phone)} parameters=${JSON.stringify(request.bodyParameters ?? [])}`,
    );
    return { provider: 'LOG', messageId: `log-${randomUUID()}` };
  }
}
