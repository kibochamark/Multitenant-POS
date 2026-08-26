import { Body, Controller, Get, Param, Post, Req, UseGuards, Version } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CreateNotificationTemplateDto, ScheduleNotificationTemplateDto } from './dto/notification-template.dto';
import { NotificationTemplateService } from './notification-template.service';

@Controller('notification-templates')
@UseGuards(AuthGuard)
export class NotificationTemplateController {
  constructor(private readonly service: NotificationTemplateService) {}
  @Get() @Version('1')
  async list(@Req() request: AuthenticatedRequest) { return { status: 200, data: await this.service.list(request.user!.id), error: null }; }
  @Post() @Version('1')
  async create(@Req() request: AuthenticatedRequest, @Body() data: CreateNotificationTemplateDto) { return { status: 201, data: await this.service.create(request.user!.id, data), error: null }; }
  @Post(':templateId/schedule') @Version('1')
  async schedule(@Req() request: AuthenticatedRequest, @Param('templateId') templateId: string, @Body() data: ScheduleNotificationTemplateDto) { return { status: 202, data: await this.service.schedule(request.user!, templateId, data), error: null }; }
}
