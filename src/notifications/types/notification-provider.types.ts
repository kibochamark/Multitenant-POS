export interface WhatsAppTemplateRequest {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
}

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}

export interface DeliveryReceipt {
  provider: 'WHATSAPP' | 'SMS' | 'LOG';
  messageId: string;
}

export class PermanentDeliveryError extends Error {}



export interface Email {
  subject:string
  to:string
  html:string
}