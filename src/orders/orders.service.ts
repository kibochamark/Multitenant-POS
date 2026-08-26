import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from 'generated/prisma/client';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(private readonly repository: OrdersRepository) {}

  async get(shopId: string, orderId: string) {
    const order = await this.repository.find(shopId, orderId);
    if (!order) throw new NotFoundException('Order not found');
    const names = await this.repository.itemNames(order.lineItems);
    return this.present(order, names);
  }

  async history(shopId: string, query: OrderHistoryQueryDto) {
    const result = await this.repository.history(shopId, query);
    // Resolve polymorphic Product/Service display data in two bulk queries,
    // rather than issuing queries for every order in the page.
    const names = await this.repository.itemNames(
      result.items.flatMap((order) => order.lineItems),
    );
    const items = result.items.map((order) => this.present(order, names));
    return {
      items,
      pageInfo: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / result.limit),
      },
    };
  }

  async cancel(shopId: string, orderId: string, userId: string, reason: string) {
    this.logger.log(`Preparing cancellation for order ${orderId}`);
    const order = await this.repository.cancel(shopId, orderId, userId, reason.trim());
    const names = await this.repository.itemNames(order.lineItems);
    return this.present(order, names);
  }

  private present<
    T extends {
      lineItems: Array<{ itemType: string; itemId: string }>;
      payments: Array<{
        method: PaymentMethod;
        status: PaymentStatus;
        amount: unknown;
      }>;
    },
  >(order: T, names: Map<string, { name: string; barcode?: string | null }>) {
    const confirmed = order.payments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED,
    );
    const hasCredit = confirmed.some(
      (payment) => payment.method === PaymentMethod.CREDIT,
    );
    const hasNormal = confirmed.some(
      (payment) => payment.method !== PaymentMethod.CREDIT,
    );
    const saleType =
      hasCredit && hasNormal ? 'MIXED' : hasCredit ? 'CREDIT' : 'NORMAL';
    return {
      ...order,
      saleType,
      lineItems: order.lineItems.map((line) => ({
        ...line,
        item: names.get(line.itemId) ?? { name: 'Unavailable catalog item' },
      })),
    };
  }
}
