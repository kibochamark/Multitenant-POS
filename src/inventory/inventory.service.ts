import { Injectable, Logger } from '@nestjs/common';
import {
  AdjustStockDto,
  MovementQueryDto,
  RestockProductDto,
  WriteOffProductDto,
} from './dto/inventory.dto';
import { InventoryRepository } from './inventory.repository';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(private readonly repository: InventoryRepository) {}

  restock(
    shopId: string,
    productId: string,
    userId: string,
    data: RestockProductDto,
  ) {
    this.logger.log(`Preparing restock for product ${productId}`);
    return this.repository.restock(
      shopId,
      productId,
      data.quantity,
      userId,
      data.note?.trim(),
    );
  }

  writeOff(
    shopId: string,
    productId: string,
    userId: string,
    data: WriteOffProductDto,
  ) {
    this.logger.log(`Preparing write-off for product ${productId}`);
    return this.repository.writeOff(
      shopId,
      productId,
      data.quantity,
      data.reason.trim(),
      userId,
      data.note?.trim(),
    );
  }

  adjust(
    shopId: string,
    productId: string,
    userId: string,
    data: AdjustStockDto,
  ) {
    this.logger.log(`Preparing adjustment for product ${productId}`);
    return this.repository.adjust(
      shopId,
      productId,
      data.quantityDelta,
      data.reason.trim(),
      userId,
      data.note?.trim(),
    );
  }

  async listMovements(
    shopId: string,
    productId: string,
    query: MovementQueryDto,
  ) {
    this.logger.log(`Preparing movement history for product ${productId}`);
    const limit = Number(query.limit ?? 25);
    const rows = await this.repository.listMovements(
      shopId,
      productId,
      limit,
      query.cursor,
    );
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
      },
    };
  }
}
