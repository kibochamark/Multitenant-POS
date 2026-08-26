import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BulkProductRowDto } from './dto/bulk-product-row.dto';
import { IMPORT_PRODUCTS_JOB, PRODUCT_IMPORT_QUEUE } from './product-import.constants';
import { ProductImportParser } from './product-import.parser';

export interface ProductImportJobData {
  shopId: string;
  userId: string;
  rows: BulkProductRowDto[];
}

export interface ProductImportStatus {
  jobId: string;
  status: string;
  progress: string | boolean | number | Record<string, unknown>;
  result: unknown;
  error: string | null;
}

@Injectable()
export class ProductImportQueueService {
  constructor(@InjectQueue(PRODUCT_IMPORT_QUEUE) private readonly queue: Queue, private readonly parser: ProductImportParser) {}

  async enqueue(shopId: string, userId: string, file: Express.Multer.File) {
    const rows = await this.parser.parse(file);
    const job = await this.queue.add(IMPORT_PRODUCTS_JOB, { shopId, userId, rows } satisfies ProductImportJobData, {
      attempts: 1, removeOnComplete: 500, removeOnFail: 1000,
    });
    return { jobId: String(job.id), status: 'QUEUED', totalRows: rows.length };
  }

  async status(shopId: string, jobId: string): Promise<ProductImportStatus> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.data.shopId !== shopId) throw new NotFoundException('Product import job not found');
    let progress: ProductImportStatus['progress'];
    if (typeof job.progress === 'object' && job.progress !== null)
      progress = job.progress as Record<string, unknown>;
    else progress = job.progress as string | boolean | number;
    return { jobId, status: (await job.getState()).toUpperCase(), progress, result: job.returnvalue ?? null, error: job.failedReason || null };
  }
}
