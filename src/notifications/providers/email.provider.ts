import { Injectable, Logger } from "@nestjs/common";
import { Email } from "../types/notification-provider.types";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";



@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resendClient;

  constructor(private configService:ConfigService) {
    const apiKey = this.configService.get('RESEND_API_KEY');
    if(!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    this.resendClient = new Resend(apiKey);
  }

  async send(
      emaildata: Email
  ): Promise<void> {
      const { data, error } = await this.resendClient.emails.send({
          from: 'Acme <onboarding@resend.dev>',
          to: [emaildata.to],
          subject: emaildata.subject,
          html: emaildata.html,
      });

      if (error) {
         throw new Error(`Failed to send email: ${error.message}`);
      }
  }
}