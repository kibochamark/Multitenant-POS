import { CatalogRepository } from './catalog.repository';

describe('CatalogRepository', () => {
  const productCreate = jest.fn();
  const serviceCreate = jest.fn();
  const queryRaw = jest.fn();
  const prisma = {
    product: { create: productCreate },
    service: { create: serviceCreate },
    $queryRaw: queryRaw,
  };

  let repository: CatalogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CatalogRepository(prisma as never);
  });

  it('creates a product and zeroed stock cache in one nested write', async () => {
    productCreate.mockResolvedValue({
      id: 'product-1',
      stockCache: { currentQuantity: 0 },
    });

    await repository.createProduct('shop-1', {
      name: 'HP 65 Black Ink',
      barcode: '889894900746',
      price: {} as never,
      costPrice: {} as never,
    });

    expect(productCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: 'shop-1',
          stockCache: { create: { currentQuantity: 0 } },
        }),
        include: { stockCache: true },
      }),
    );
  });

  it('creates a service without stock cache or stock movement data', async () => {
    serviceCreate.mockResolvedValue({ id: 'service-1' });

    await repository.createService('shop-1', {
      name: 'Laptop diagnosis',
      price: {} as never,
      createdById: 'user-1',
    });

    const call = serviceCreate.mock.calls[0][0];
    expect(call.data).toEqual(
      expect.objectContaining({
        shopId: 'shop-1',
        name: 'Laptop diagnosis',
        createdById: 'user-1',
      }),
    );
    expect(call.data).not.toHaveProperty('stockCache');
    expect(call.data).not.toHaveProperty('stockMovements');
  });

  it('quotes Prisma camelCase columns in the PostgreSQL product search', async () => {
    queryRaw.mockResolvedValue([]);

    await repository.searchProducts('shop-1', 'ink', 25, 0);

    const query = queryRaw.mock.calls[0][0] as { strings: string[] };
    const sql = query.strings.join('?');
    expect(sql).toContain('sc."productId" = p.id');
    expect(sql).toContain('sc."currentQuantity"');
    expect(sql).toContain('p."shopId" =');
    expect(sql).toContain('p."isActive" = true');
  });
});
