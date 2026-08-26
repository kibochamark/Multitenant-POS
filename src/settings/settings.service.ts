import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  UpdateCompanySettingsDto,
  UpdateNotificationPreferenceDto,
  UpdateProfileDto,
  UpdateShopSettingsDto,
} from './dto/settings.dto';
import { SettingsRepository } from './settings.repository';

const defaultPreference = {
  enabled: true,
  inAppEnabled: true,
  whatsappEnabled: false,
  smsEnabled: false,
  whatsappOptInAt: null,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  constructor(private readonly repository: SettingsRepository) {}

  async get(shopId: string, userId: string) {
    const [user, shop] = await this.repository.get(shopId, userId);
    return {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      notifications: user.notificationPreference ?? defaultPreference,
      company: shop.company,
      shop: {
        id: shop.id,
        name: shop.name,
        vatPct: shop.vatPct,
        defaultMinMarginPct: shop.defaultMinMarginPct,
        globalDiscountPct: shop.globalDiscountPct,
      },
      effective: {
        vatPct: shop.vatPct ?? shop.company.vatPct,
        defaultMinMarginPct:
          shop.defaultMinMarginPct ?? shop.company.defaultMinMarginPct,
        globalDiscountPct:
          shop.globalDiscountPct ?? shop.company.globalDiscountPct,
      },
    };
  }

  updateProfile(userId: string, data: UpdateProfileDto) {
    return this.repository.updateProfile(userId, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
    });
  }

  async updateNotifications(
    userId: string,
    data: UpdateNotificationPreferenceDto,
  ) {
    const user = await this.repository.getForNotifications(userId);
    console.log('user notification preference', data, user.notificationPreference);
    if (data.whatsappEnabled && !user.phone) {
      throw new ConflictException(
        'Add a phone number before enabling WhatsApp notifications',
      );
    }
    if (data.smsEnabled) {
      throw new ConflictException('SMS notifications are not implemented yet');
    }
    const existingOptIn = user.notificationPreference?.whatsappOptInAt ?? null;
    if (data.whatsappEnabled && !existingOptIn && !data.optIn) {
      throw new ConflictException('WhatsApp opt-in consent is required');
    }
    return this.repository.updateNotificationPreference(userId, {
      enabled: data.enabled,
      inAppEnabled: data.inAppEnabled,
      whatsappEnabled: data.whatsappEnabled,
      smsEnabled: false,
      whatsappOptInAt: data.whatsappEnabled
        ? (existingOptIn ?? new Date())
        : existingOptIn,
    });
  }

  updateCompany(companyId: string, data: UpdateCompanySettingsDto) {
    return this.repository.updateCompany(companyId, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.vatPct !== undefined ? { vatPct: data.vatPct } : {}),
      ...(data.defaultMinMarginPct !== undefined
        ? { defaultMinMarginPct: data.defaultMinMarginPct }
        : {}),
      ...(data.globalDiscountPct !== undefined
        ? { globalDiscountPct: data.globalDiscountPct }
        : {}),
    });
  }

  updateShop(shopId: string, data: UpdateShopSettingsDto) {
    return this.repository.updateShop(shopId, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.vatPct !== undefined ? { vatPct: data.vatPct } : {}),
      ...(data.defaultMinMarginPct !== undefined
        ? { defaultMinMarginPct: data.defaultMinMarginPct }
        : {}),
      ...(data.globalDiscountPct !== undefined
        ? { globalDiscountPct: data.globalDiscountPct }
        : {}),
    });
  }
}
