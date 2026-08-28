import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './globalservices/prisma/prisma.module';
import { AuthGuard } from './guards/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CartModule } from './cart/cart.module';
import { CustomersModule } from './customers/customers.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from './notifications/notifications.constants';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulingModule } from './scheduling/scheduling.module';
import { AdministrationModule } from './administration/administration.module';
import { AccountsModule } from './accounts/accounts.module';
import { RefundsModule } from './refunds/refunds.module';
import { AccountingModule } from './accounting/accounting.module';
import { SurplusModule } from './surplus/surplus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    CompanyModule,
    OnboardingModule,
    CatalogModule,
    InventoryModule,
    ExpensesModule,
    CartModule,
    CustomersModule,
    PaymentsModule,
    OrdersModule,
    SettingsModule,
    NotificationsModule,
    SchedulingModule,
    AdministrationModule,
    AccountsModule,
    RefundsModule,
    AccountingModule,
    SurplusModule,
  ],
  controllers: [],
})
export class AppModule {}
