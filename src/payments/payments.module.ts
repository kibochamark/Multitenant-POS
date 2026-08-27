import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AccountingModule } from 'src/accounting/accounting.module';

@Module({
  imports: [NotificationsModule, AccountingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, AuthGuard, ShopAccessGuard],
})
export class PaymentsModule {}
