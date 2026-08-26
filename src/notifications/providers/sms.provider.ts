import { Injectable } from '@nestjs/common';
import { PermanentDeliveryError } from '../types/notification-provider.types';

@Injectable()
export class SmsProvider {
  async send(): Promise<never> {
    // The interface exists so business code never depends on a future SMS
    // vendor. Implement Africa's Talking/AWS/Twilio behind this boundary later.
    throw new PermanentDeliveryError('SMS provider is not implemented');
  }
}
