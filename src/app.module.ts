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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    CompanyModule,
    OnboardingModule,
    CatalogModule,
    InventoryModule,
    ExpensesModule,
    CartModule,
  ],
  controllers: [],
})
export class AppModule {}
