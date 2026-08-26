import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryReceipt,
  PermanentDeliveryError,
  WhatsAppTemplateRequest,
  WhatsAppCredentials,
} from '../types/notification-provider.types';
import { maskPhoneNumber, normalizePhoneNumber } from '../utils/phone.utils';

@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  async sendTemplate(
    request: WhatsAppTemplateRequest,
    credentials: WhatsAppCredentials,
  ): Promise<DeliveryReceipt> {
    const { accessToken, phoneNumberId } = credentials;
    const apiVersion = credentials.apiVersion ?? 'v25.0';
    if (!accessToken || !phoneNumberId) {
      throw new PermanentDeliveryError(
        'WhatsApp provider credentials are not configured',
      );
    }
    const to = normalizePhoneNumber(request.to);
    
    this.logger.log(
      `Sending WhatsApp template ${request.templateName} to ${to}`,
    );

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: request.templateName,
            language: { code: request.languageCode ?? 'en' },
            ...(request.bodyParameters?.length
              ? {
                  components: [
                    {
                      type: 'body',
                      parameters: request.bodyParameters.map((text) => ({
                        type: 'text',
                        text,
                      })),
                    },
                  ],
                }
              : {}),
          },
        }),
      },
    );

    console.log(response, "whatsapp rs")
    const payload = (await response.json().catch(() => null)) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      const message =
        payload?.error?.message ?? `WhatsApp returned HTTP ${response.status}`;
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        throw new PermanentDeliveryError(message);
      }
      throw new Error(message);
    }
    const messageId = payload?.messages?.[0]?.id;
    if (!messageId) throw new Error('WhatsApp did not return a message ID');
    return { provider: 'WHATSAPP', messageId };
  }
}
