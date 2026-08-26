import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { NotificationChannel, NotificationType, Prisma } from 'generated/prisma/client';
import { NotificationService } from 'src/notifications/notification.service';
import { CatalogRepository } from './catalog.repository';
import { IMPORT_PRODUCTS_JOB, PRODUCT_IMPORT_BATCH_SIZE, PRODUCT_IMPORT_QUEUE } from './product-import.constants';
import { ProductImportJobData } from './product-import-queue.service';

@Injectable()
@Processor(PRODUCT_IMPORT_QUEUE)
export class ProductImportProcessor extends WorkerHost {
  constructor(private readonly repository: CatalogRepository, private readonly notifications: NotificationService) { super(); }

  async process(job: Job<ProductImportJobData>) {
    if (job.name !== IMPORT_PRODUCTS_JOB) throw new UnrecoverableError(`Unknown product import job ${job.name}`);
    let imported = 0;
    try {
      for (let offset = 0; offset < job.data.rows.length; offset += PRODUCT_IMPORT_BATCH_SIZE) {
        const source = job.data.rows.slice(offset, offset + PRODUCT_IMPORT_BATCH_SIZE);
        const barcodes = await this.repository.generateAvailableBarcodes(job.data.shopId, source.length);
        const batch = source.map((row, index) => ({
          name: row.name.trim(), barcode: barcodes[index], price: new Prisma.Decimal(row.price),
          costPrice: new Prisma.Decimal(row.costPrice), quantityAtHand: row.quantityAtHand,
          ...(row.category?.trim() ? { category: row.category.trim() } : {}),
          ...(row.minMarginPct !== undefined ? { minMarginPct: row.minMarginPct } : {}),
          ...(row.minPrice !== undefined ? { minPrice: new Prisma.Decimal(row.minPrice) } : {}),
          ...(row.lowStockThreshold !== undefined ? { lowStockThreshold: row.lowStockThreshold } : {}),
        }));
        await this.repository.importProductBatch(job.data.shopId, job.data.userId, batch);
        imported += batch.length;
        await job.updateProgress({ imported, total: job.data.rows.length });
      }
      await this.notify(job, `Product import completed: ${imported} products created.` , 'COMPLETED', imported);
      return { imported, total: job.data.rows.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      await this.notify(job, `Product import stopped after ${imported} of ${job.data.rows.length} products: ${message}`, 'FAILED', imported);
      throw new UnrecoverableError(message);
    }
  }

  private notify(job: Job<ProductImportJobData>, message: string, status: string, imported: number) {
    return this.notifications.createForUser({
      userId: job.data.userId, shopId: job.data.shopId, type: NotificationType.GENERIC,
      message, templateName: 'product_import_result', channels: [NotificationChannel.IN_APP],
      metadata: { jobId: String(job.id), status, imported, total: job.data.rows.length },
    });
  }
}
