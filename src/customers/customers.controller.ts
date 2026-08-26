import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Version,
} from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CustomersService } from './customers.service';
import {
  ChangeCreditLimitDto,
  CreateCustomerDto,
  CustomerListQueryDto,
  CustomerSearchQueryDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Controller('shops/:shopId/customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);
  constructor(private readonly service: CustomersService) {}

  @Post()
  @Version('1')
  @RequireShopAccess('shopId')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() data: CreateCustomerDto,
  ) {
    this.logger.log('Customer creation request received');
    return {
      status: 201,
      data: await this.service.create(request.user!.companyId, data),
      error: null,
    };
  }

  @Get()
  @Version('1')
  @RequireShopAccess('shopId')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CustomerListQueryDto,
  ) {
    return {
      status: 200,
      data: await this.service.list(request.user!.companyId, query),
      error: null,
    };
  }

  @Get('search')
  @Version('1')
  @RequireShopAccess('shopId')
  async search(
    @Req() request: AuthenticatedRequest,
    @Query() query: CustomerSearchQueryDto,
  ) {
    return {
      status: 200,
      data: await this.service.search(request.user!.companyId, query),
      error: null,
    };
  }

  @Get(':customerId')
  @Version('1')
  @RequireShopAccess('shopId')
  async get(
    @Param('customerId') customerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      status: 200,
      data: await this.service.get(request.user!.companyId, customerId),
      error: null,
    };
  }

  @Patch(':customerId')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async update(
    @Param('customerId') customerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: UpdateCustomerDto,
  ) {
    return {
      status: 200,
      data: await this.service.update(
        request.user!.companyId,
        customerId,
        data,
      ),
      error: null,
    };
  }

  @Patch(':customerId/credit-limit')
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async changeCreditLimit(
    @Param('customerId') customerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: ChangeCreditLimitDto,
  ) {
    return {
      status: 200,
      data: await this.service.changeCreditLimit(
        request.user!.companyId,
        customerId,
        request.user!.id,
        data,
      ),
      error: null,
    };
  }
}
