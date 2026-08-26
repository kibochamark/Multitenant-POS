import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthGuard } from 'src/guards/auth.guard';
import { ShopAccessGuard } from 'src/guards/shop-access.guard';
import { CatalogController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { ProductImportParser } from './product-import.parser';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PRODUCT_IMPORT_QUEUE } from './product-import.constants';
import { ProductImportQueueService } from './product-import-queue.service';
import { ProductImportProcessor } from './product-import.processor';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: PRODUCT_IMPORT_QUEUE })],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRepository, ProductImportParser, ProductImportQueueService, ProductImportProcessor, AuthGuard, ShopAccessGuard],
})
export class CatalogModule {}
