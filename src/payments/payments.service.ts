import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import {
  AmountDto,
  CreditPaymentDto,
  ManualMpesaPaymentDto,
  VerifyMpesaPaymentDto,
} from './dto/payment.dto';
import { PaymentsRepository } from './payments.repository';
import { NotificationQueueService } from 'src/notifications/notification-queue.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async getOrder(shopId: string, orderId: string) {
    const order = await this.repository.getOrder(shopId, orderId);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  recordCash(shopId: string, orderId: string, userId: string, data: AmountDto) {
    this.logger.log(`Preparing cash payment for order ${orderId}`);
    return this.repository.recordCash(
      shopId,
      orderId,
      userId,
      new Prisma.Decimal(data.amount),
    );
  }

  async recordManualMpesa(
    shopId: string,
    orderId: string,
    userId: string,
    data: ManualMpesaPaymentDto,
  ) {
    this.logger.log(`Preparing manual M-Pesa payment for order ${orderId}`);
    const { notificationDeliveryIds, ...result } = await this.repository.recordManualMpesa(
      shopId,
      orderId,
      userId,
      new Prisma.Decimal(data.amount),
      data.referenceCode.trim().toUpperCase(),
    );
    // The payment/outbox rows are already committed. Queueing is best effort;
    // the scheduled outbox recovery handles Redis outages safely.
    await Promise.allSettled(
      notificationDeliveryIds.map((id) => this.notificationQueue.enqueue(id)),
    );
    return result;
  }

  recordCredit(
    shopId: string,
    orderId: string,
    userId: string,
    data: CreditPaymentDto,
  ) {
    this.logger.log(`Preparing credit payment for order ${orderId}`);
    return this.repository.recordCredit(
      shopId,
      orderId,
      userId,
      new Prisma.Decimal(data.amount),
      data.dueDate ? new Date(data.dueDate) : undefined,
      data.note?.trim() || undefined,
    );
  }

  verifyManualMpesa(
    shopId: string,
    orderId: string,
    paymentId: string,
    verifierId: string,
    data: VerifyMpesaPaymentDto,
  ) {
    this.logger.log(`Preparing verification for payment ${paymentId}`);
    return this.repository.verifyManualMpesa(
      shopId,
      orderId,
      paymentId,
      verifierId,
      data.result,
      data.reason,
    );
  }
}
