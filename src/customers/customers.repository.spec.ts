import { Prisma } from 'generated/prisma/client';
import { CustomersRepository } from './customers.repository';

describe('CustomersRepository', () => {
  const customerFindFirst = jest.fn();
  const customerUpdate = jest.fn();
  const changeCreate = jest.fn();
  const tx = {
    customer: { findFirst: customerFindFirst, update: customerUpdate },
    customerCreditLimitChange: { create: changeCreate },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const repository = new CustomersRepository(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('changes the limit and writes the previous/new values to an audit row', async () => {
    customerFindFirst.mockResolvedValue({
      id: 'customer-1',
      creditLimit: new Prisma.Decimal('5000.00'),
    });
    customerUpdate.mockResolvedValue({ id: 'customer-1' });
    changeCreate.mockResolvedValue({ id: 'change-1' });

    await repository.changeCreditLimit(
      'company-1',
      'customer-1',
      'manager-1',
      new Prisma.Decimal('8000.00'),
      'Reliable repayment history',
    );

    expect(customerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'customer-1' },
        data: { creditLimit: new Prisma.Decimal('8000.00') },
      }),
    );
    expect(changeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          customerId: 'customer-1',
          previousLimit: new Prisma.Decimal('5000.00'),
          newLimit: new Prisma.Decimal('8000.00'),
          reason: 'Reliable repayment history',
          changedById: 'manager-1',
        },
      }),
    );
  });
});
