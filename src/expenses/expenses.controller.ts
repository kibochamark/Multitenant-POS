import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Version,
} from '@nestjs/common';
import { RequireShopAccess } from 'src/guards/require-shop-access.decorator';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CreateExpenseDto, ExpenseListQueryDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('shops/:shopId/expenses')
export class ExpensesController {
  private readonly logger = new Logger(ExpensesController.name);
  constructor(private readonly service: ExpensesService) {}

  @Post()
  @Version('1')
  @HttpCode(201)
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async create(
    @Param('shopId') shopId: string,
    @Req() request: AuthenticatedRequest,
    @Body() data: CreateExpenseDto,
  ) {
    this.logger.log(`Expense request received for shop ${shopId}`);
    return {
      status: 201,
      data: await this.service.create(shopId, request.user!.id, data),
      error: null,
    };
  }

  @Get()
  @Version('1')
  @RequireShopAccess('shopId', 'OWNER', 'MANAGER')
  async list(
    @Param('shopId') shopId: string,
    @Query() query: ExpenseListQueryDto,
  ) {
    this.logger.log(`Expense list request received for shop ${shopId}`);
    return {
      status: 200,
      data: await this.service.list(shopId, query),
      error: null,
    };
  }
}
