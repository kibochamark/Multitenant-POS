import { Controller, Get, Logger, Param, Patch, Query, Req, Version } from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { InAppNotificationService } from './in-app-notification.service';

@Controller('shops/:shopId/notifications')
export class InAppNotificationController {
  private readonly logger = new Logger(InAppNotificationController.name);
  constructor(private readonly service: InAppNotificationService) {}

  @Get()
  @Version('1')
  @RequireShopAccess('shopId')
  async list(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    this.logger.log(`Notification feed requested in shop ${shopId}`);
    return { status: 200, data: await this.service.list(shopId, request.user!.id, limit, cursor), error: null };
  }

  @Patch('read-all')
  @Version('1')
  @RequireShopAccess('shopId')
  async readAll(@Param('shopId') shopId: string, @Req() request: AuthenticatedRequest) {
    return { status: 200, data: await this.service.markAllRead(shopId, request.user!.id), error: null };
  }

  @Patch(':notificationId/read')
  @Version('1')
  @RequireShopAccess('shopId')
  async read(@Param('shopId') shopId: string, @Param('notificationId') notificationId: string, @Req() request: AuthenticatedRequest) {
    return { status: 200, data: await this.service.markRead(shopId, notificationId, request.user!.id), error: null };
  }
}
