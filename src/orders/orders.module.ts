import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { AccountingModule } from 'src/accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, AuthGuard, ShopAccessGuard],
})
export class OrdersModule {}
