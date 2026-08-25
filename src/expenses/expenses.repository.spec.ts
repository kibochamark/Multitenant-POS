import { ExpensesRepository } from './expenses.repository';

describe('ExpensesRepository', () => {
  const create = jest.fn();
  const findMany = jest.fn();
  const repository = new ExpensesRepository({
    expense: { create, findMany },
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it('records the authenticated internal user and returns recorder details', async () => {
    create.mockResolvedValue({ id: 'expense-1' });

    await repository.create('shop-1', 'user-1', {
      amount: {} as never,
      category: 'Utilities',
      description: 'Internet bill',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: 'shop-1',
        recordedById: 'user-1',
        category: 'Utilities',
      }),
      include: {
        recordedBy: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it('scopes expense history to the selected shop', async () => {
    findMany.mockResolvedValue([]);
    await repository.list('shop-1', { limit: 25 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: 'shop-1' }, take: 26 }),
    );
  });
});
