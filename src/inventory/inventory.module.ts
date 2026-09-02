import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { AccountingModule } from 'src/accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryRepository,
    AuthGuard,
    ShopAccessGuard,
  ],
})
export class InventoryModule {}
