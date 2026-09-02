import { BadRequestException, Body, Controller, Get, Param, Put, Post, Req, UseGuards, Version } from '@nestjs/common';
import { NotificationChannel } from 'generated/prisma/client';
import { AuthGuard } from 'src/guards/auth.guard';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { TestNotificationChannelDto, UpdateNotificationChannelDto, isSupportedNotificationChannel } from './dto/notification-channel.dto';
import { NotificationChannelService } from './notification-channel.service';

@Controller('notification-channels')
@UseGuards(AuthGuard)
export class NotificationChannelController {
  constructor(private readonly service: NotificationChannelService) {}

  @Get()
  @Version('1')
  async list(@Req() request: AuthenticatedRequest) {
    return { status: 200, data: await this.service.list(request.user!.id), error: null };
  }

  @Put(':channel')
  @Version('1')
  async update(@Req() request: AuthenticatedRequest, @Param('channel') value: string, @Body() data: UpdateNotificationChannelDto) {
    const channel = this.channel(value);
    return { status: 200, data: await this.service.update(request.user!.id, channel, data), error: null };
  }

  @Post(':channel/test')
  @Version('1')
  async test(@Req() request: AuthenticatedRequest, @Param('channel') value: string, @Body() data: TestNotificationChannelDto) {
    const channel = this.channel(value);
    return { status: 202, data: await this.service.test(request.user!.id, channel, data), error: null };
  }

  private channel(value: string) {
    const channel = value.toUpperCase();
    if (!isSupportedNotificationChannel(channel)) throw new BadRequestException('Only IN_APP, WHATSAPP, and EMAIL are supported');
    return channel as NotificationChannel;
  }
}
