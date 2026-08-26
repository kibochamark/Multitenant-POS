import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import {
  ChangeCreditLimitDto,
  CreateCustomerDto,
  CustomerListQueryDto,
  CustomerSearchQueryDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  constructor(private readonly repository: CustomersRepository) {}

  async create(companyId: string, data: CreateCustomerDto) {
    this.logger.log(`Preparing customer creation for company ${companyId}`);
    try {
      return this.present(
        await this.repository.create(companyId, {
          name: data.name.trim(),
          ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
          ...(data.email?.trim()
            ? { email: data.email.trim().toLowerCase() }
            : {}),
          ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
        }),
      );
    } catch (error) {
      this.handleUniqueConflict(error);
    }
  }

  async list(companyId: string, query: CustomerListQueryDto) {
    const limit = Number(query.limit ?? 25);
    const rows = await this.repository.list(companyId, limit, query.cursor);
    const hasNextPage = rows.length > limit;
    const items = (hasNextPage ? rows.slice(0, limit) : rows).map((customer) =>
      this.present(customer),
    );
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
      },
    };
  }

  async search(companyId: string, query: CustomerSearchQueryDto) {
    const limit = Number(query.limit ?? 25);
    const page = Number(query.page ?? 1);
    const rows = await this.repository.search(
      companyId,
      query.q.trim(),
      limit,
      (page - 1) * limit,
    );
    return {
      items: rows.map((customer) => this.present(customer)),
      pageInfo: { page, limit, hasNextPage: rows.length === limit },
    };
  }

  async get(companyId: string, customerId: string) {
    const customer = await this.repository.find(companyId, customerId);
    if (!customer) throw new NotFoundException('Customer not found');
    return this.present(customer);
  }

  async update(companyId: string, customerId: string, data: UpdateCustomerDto) {
    this.logger.log(`Preparing customer update for ${customerId}`);
    try {
      const customer = await this.repository.update(companyId, customerId, {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone.trim() || null }
          : {}),
        ...(data.email !== undefined
          ? { email: data.email.trim().toLowerCase() || null }
          : {}),
        ...(data.notes !== undefined
          ? { notes: data.notes.trim() || null }
          : {}),
      });
      if (!customer) throw new NotFoundException('Customer not found');
      return this.present(customer);
    } catch (error) {
      this.handleUniqueConflict(error);
    }
  }

  async changeCreditLimit(
    companyId: string,
    customerId: string,
    changedById: string,
    data: ChangeCreditLimitDto,
  ) {
    this.logger.log(`Preparing credit-limit change for ${customerId}`);
    const result = await this.repository.changeCreditLimit(
      companyId,
      customerId,
      changedById,
      new Prisma.Decimal(data.newLimit),
      data.reason.trim(),
    );
    if (!result) throw new NotFoundException('Customer not found');
    return { ...result, customer: this.present(result.customer) };
  }

  private present<
    T extends {
      creditLimit: Prisma.Decimal;
      creditAccount?: { currentBalance: Prisma.Decimal } | null;
    },
  >(customer: T) {
    const currentBalance =
      customer.creditAccount?.currentBalance ?? new Prisma.Decimal(0);
    const availableCredit = Prisma.Decimal.max(
      customer.creditLimit.sub(currentBalance),
      new Prisma.Decimal(0),
    );
    return { ...customer, currentBalance, availableCredit };
  }

  private handleUniqueConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A customer with this phone or email already exists in this company',
      );
    }
    throw error;
  }
}
