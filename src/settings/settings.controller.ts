import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Req,
  Version,
} from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import {
  UpdateCompanySettingsDto,
  UpdateNotificationPreferenceDto,
  UpdateProfileDto,
  UpdateShopSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('shops/:shopId/settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);
  constructor(private readonly service: SettingsService) {}

  @Get()
  @Version('1')
  @RequireShopAccess('shopId')
  async get(
    @Param('shopId') shopId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      status: 200,
      data: await this.service.get(shopId, request.user!.id),
      error: null,
    };
  }

  @Patch('profile')
  @Version('1')
  @RequireShopAccess('shopId')
  async profile(
    @Req() request: AuthenticatedRequest,
    @Body() data: UpdateProfileDto,
  ) {
    this.logger.log(`Profile settings request from user ${request.user!.id}`);
    return {
      status: 200,
      data: await this.service.updateProfile(request.user!.id, data),
      error: null,
    };
  }

  @Patch('notifications')
  @Version('1')
  @RequireShopAccess('shopId')
  async notifications(
    @Req() request: AuthenticatedRequest,
    @Body() data: UpdateNotificationPreferenceDto,
  ) {
    this.logger.log(
      `Notification settings request from user ${request.user!.id}`,
    );
    return {
      status: 200,
      data: await this.service.updateNotifications(request.user!.id, data),
      error: null,
    };
  }

  @Patch('company')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER')
  async company(
    @Req() request: AuthenticatedRequest,
    @Body() data: UpdateCompanySettingsDto,
  ) {
    this.logger.log(`Company settings request from user ${request.user!.id}`);
    return {
      status: 200,
      data: await this.service.updateCompany(request.user!.companyId, data),
      error: null,
    };
  }

  @Patch('shop')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async shop(
    @Param('shopId') shopId: string,
    @Body() data: UpdateShopSettingsDto,
  ) {
    this.logger.log(`Shop settings request for shop ${shopId}`);
    return {
      status: 200,
      data: await this.service.updateShop(shopId, data),
      error: null,
    };
  }
}
