import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './globalservices/prisma/prisma.module';
import { AuthGuard } from './guards/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
  }
  ), PrismaModule, UsersModule, CompanyModule],
  controllers: []
})
export class AppModule {}
