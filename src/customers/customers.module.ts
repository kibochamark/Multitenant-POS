import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { CustomersController } from './customers.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';
import { CreditRepaymentsController } from './credit-repayments.controller';
import { CreditRepaymentsService } from './credit-repayments.service';
import { CreditRepaymentsRepository } from './credit-repayments.repository';
import { AccountingModule } from 'src/accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [CustomersController, CreditRepaymentsController],
  providers: [
    CustomersService,
    CustomersRepository,
    AuthGuard,
    ShopAccessGuard,
    CreditRepaymentsService,
    CreditRepaymentsRepository,
  ],
})
export class CustomersModule {}
