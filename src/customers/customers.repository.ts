import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

const customerInclude = {
  creditAccount: true,
} satisfies Prisma.CustomerInclude;

@Injectable()
export class CustomersRepository {
  private readonly logger = new Logger(CustomersRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  create(
    companyId: string,
    data: { name: string; phone?: string; email?: string; notes?: string },
  ) {
    this.logger.log(`Creating customer for company ${companyId}`);
    return this.prisma.customer.create({
      data: {
        companyId,
        ...data,
        creditAccount: { create: { currentBalance: new Prisma.Decimal(0) } },
      },
      include: customerInclude,
    });
  }

  list(companyId: string, limit: number, cursor?: string) {
    this.logger.log(`Listing customers for company ${companyId}`);
    return this.prisma.customer.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: customerInclude,
    });
  }

  search(companyId: string, query: string, limit: number, offset: number) {
    this.logger.log(`Searching customers for company ${companyId}`);
    return this.prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit,
      skip: offset,
      include: customerInclude,
    });
  }

  find(companyId: string, customerId: string) {
    this.logger.log(`Finding customer ${customerId}`);
    return this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      include: {
        ...customerInclude,
        creditLimitChanges: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { changedBy: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async update(
    companyId: string,
    customerId: string,
    data: Prisma.CustomerUpdateInput,
  ) {
    this.logger.log(`Updating customer ${customerId}`);
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });
      if (!customer) return null;
      return tx.customer.update({
        where: { id: customerId },
        data,
        include: customerInclude,
      });
    });
  }

  async changeCreditLimit(
    companyId: string,
    customerId: string,
    changedById: string,
    newLimit: Prisma.Decimal,
    reason: string,
  ) {
    this.logger.log(`Changing credit limit for customer ${customerId}`);
    return this.prisma.$transaction(async (tx) => {
      // Load and update inside one transaction so the audit row always records
      // the exact previous value that was replaced.
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true, creditLimit: true },
      });
      if (!customer) return null;
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { creditLimit: newLimit },
        include: customerInclude,
      });
      const change = await tx.customerCreditLimitChange.create({
        data: {
          customerId,
          previousLimit: customer.creditLimit,
          newLimit,
          reason,
          changedById,
        },
        include: { changedBy: { select: { id: true, name: true } } },
      });
      return { customer: updated, change };
    });
  }
}
