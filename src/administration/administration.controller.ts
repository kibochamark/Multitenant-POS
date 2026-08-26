import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Req, UseGuards, Version } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { AdministrationService } from './administration.service';
import { ChangeMembershipDto, ChangeUserStatusDto, CreateManagedShopDto } from './dto/administration.dto';

@Controller()
export class AdministrationController {
  private readonly logger = new Logger(AdministrationController.name);
  constructor(private readonly service: AdministrationService) {}

  @Post('companies/:companyId/shops') @Version('1') @UseGuards(AuthGuard)
  async createShop(@Param('companyId') companyId: string, @Req() request: AuthenticatedRequest, @Body() data: CreateManagedShopDto) { this.logger.log(`Owner shop creation in company ${companyId}`); return { status: 201, data: await this.service.createShop(request.user!, companyId, data), error: null }; }
  @Get('companies/:companyId/dashboard') @Version('1') @UseGuards(AuthGuard)
  async companyDashboard(@Param('companyId') companyId: string, @Req() request: AuthenticatedRequest) { return { status: 200, data: await this.service.companyDashboard(request.user!, companyId), error: null }; }
  @Get('companies/:companyId/users') @Version('1') @UseGuards(AuthGuard)
  async users(@Param('companyId') companyId: string, @Req() request: AuthenticatedRequest) { return { status: 200, data: await this.service.users(request.user!, companyId), error: null }; }
  @Patch('companies/:companyId/users/:userId/status') @Version('1') @UseGuards(AuthGuard)
  async status(@Param('companyId') companyId: string, @Param('userId') userId: string, @Req() request: AuthenticatedRequest, @Body() data: ChangeUserStatusDto) { return { status: 200, data: await this.service.status(request.user!, companyId, userId, data), error: null }; }
  @Patch('companies/:companyId/users/:userId/shops/:shopId') @Version('1') @UseGuards(AuthGuard)
  async membership(@Param('companyId') companyId: string, @Param('userId') userId: string, @Param('shopId') shopId: string, @Req() request: AuthenticatedRequest, @Body() data: ChangeMembershipDto) { return { status: 200, data: await this.service.membership(request.user!, companyId, userId, shopId, data), error: null }; }
  @Delete('companies/:companyId/users/:userId/shops/:shopId') @Version('1') @UseGuards(AuthGuard)
  async removeMembership(@Param('companyId') companyId: string, @Param('userId') userId: string, @Param('shopId') shopId: string, @Req() request: AuthenticatedRequest) { return { status: 200, data: await this.service.removeMembership(request.user!, companyId, userId, shopId), error: null }; }
  @Get('shops/:shopId/dashboard') @Version('1') @RequireShopAccess('shopId')
  async dashboard(@Param('shopId') shopId: string) { return { status: 200, data: await this.service.dashboard(shopId), error: null }; }
}
