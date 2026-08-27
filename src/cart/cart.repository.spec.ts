import { NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { CartRepository } from './cart.repository';

describe('CartRepository', () => {
  const productFindUnique = jest.fn();
  const productFindMany = jest.fn();
  const cartUpsert = jest.fn();
  const cartUpdate = jest.fn();
  const cartFindUniqueOrThrow = jest.fn();
  const cartFindFirst = jest.fn();
  const itemUpsert = jest.fn();
  const itemFindUnique = jest.fn();
  const itemDeleteMany = jest.fn();
  const shopFindUniqueOrThrow = jest.fn();
  const serviceFindMany = jest.fn();
  const orderCreate = jest.fn();
  const orderFindUniqueOrThrow = jest.fn();
  const tx = {
    product: { findUnique: productFindUnique, findMany: productFindMany },
    cart: {
      upsert: cartUpsert,
      update: cartUpdate,
      findUniqueOrThrow: cartFindUniqueOrThrow,
      findFirst: cartFindFirst,
    },
    cartItem: {
      upsert: itemUpsert,
      findUnique: itemFindUnique,
      deleteMany: itemDeleteMany,
    },
    shop: { findUniqueOrThrow: shopFindUniqueOrThrow },
    service: { findMany: serviceFindMany },
    customer: { findFirst: jest.fn() },
    order: {
      create: orderCreate,
      findUniqueOrThrow: orderFindUniqueOrThrow,
    },
    stockCache: { updateMany: jest.fn() },
    stockMovement: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const initializeInTransaction = jest.fn();
  const postJournal = jest.fn();
  const repository = new CartRepository(
    prisma as never,
    { initializeInTransaction } as never,
    { post: postJournal } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    itemFindUnique.mockResolvedValue(null);
  });

  it('atomically finds/creates the active cart and increments the scanned item', async () => {
    productFindUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Mouse',
      barcode: '123',
      price: '1200.00',
      isActive: true,
      stockCache: { currentQuantity: 8 },
    });
    cartUpsert.mockResolvedValue({ id: 'cart-1' });
    itemUpsert.mockResolvedValue({ id: 'item-1' });
    cartUpdate.mockResolvedValue({ id: 'cart-1' });
    cartFindUniqueOrThrow.mockResolvedValue({ id: 'cart-1', items: [] });
    productFindMany.mockResolvedValue([]);

    await repository.scanProduct('shop-1', 'user-1', 'counter-1', '123');

    expect(cartUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activeKey: 'shop-1:user-1:counter-1' },
      }),
    );
    expect(itemUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cartId_itemType_itemId: {
            cartId: 'cart-1',
            itemType: 'PRODUCT',
            itemId: 'product-1',
          },
        },
        update: { quantity: { increment: 1 } },
      }),
    );
    expect(cartUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cart-1' } }),
    );
  });

  it('rejects missing or inactive barcodes before creating a cart', async () => {
    productFindUnique.mockResolvedValue(null);
    await expect(
      repository.scanProduct('shop-1', 'user-1', 'counter-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(cartUpsert).not.toHaveBeenCalled();
  });

  it('rejects an out-of-stock product before creating a cart', async () => {
    productFindUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Mouse',
      barcode: '123',
      price: new Prisma.Decimal('1200.00'),
      isActive: true,
      stockCache: { currentQuantity: 0 },
    });

    await expect(
      repository.scanProduct('shop-1', 'user-1', 'counter-1', '123'),
    ).rejects.toThrow('Mouse is out of stock');
    expect(cartUpsert).not.toHaveBeenCalled();
    expect(itemUpsert).not.toHaveBeenCalled();
  });

  it('rejects a scan when the cart already contains all available units', async () => {
    productFindUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Mouse',
      barcode: '123',
      price: new Prisma.Decimal('1200.00'),
      isActive: true,
      stockCache: { currentQuantity: 2 },
    });
    cartUpsert.mockResolvedValue({ id: 'cart-1' });
    itemFindUnique.mockResolvedValue({ quantity: 2 });

    await expect(
      repository.scanProduct('shop-1', 'user-1', 'counter-1', '123'),
    ).rejects.toThrow('Only 2 units of Mouse available');
    expect(itemUpsert).not.toHaveBeenCalled();
  });

  it('deletes working items and marks a manually reset cart abandoned', async () => {
    cartFindFirst.mockResolvedValue({ id: 'cart-1' });
    itemDeleteMany.mockResolvedValue({ count: 2 });
    cartUpdate.mockResolvedValue({
      id: 'cart-1',
      status: 'ABANDONED',
      activeKey: null,
    });

    const result = await repository.abandon(
      'shop-1',
      'cart-1',
      'user-1',
      'counter-1',
    );

    expect(cartFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'cart-1',
        activeKey: 'shop-1:user-1:counter-1',
        status: 'ACTIVE',
      }),
      select: { id: true },
    });
    expect(itemDeleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1' },
    });
    expect(cartUpdate).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: expect.objectContaining({ status: 'ABANDONED', activeKey: null }),
    });
    expect(result.status).toBe('ABANDONED');
  });

  it('snapshots service lines, calculates inclusive VAT, and completes the cart', async () => {
    cartFindFirst.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          itemType: 'SERVICE',
          itemId: 'service-1',
          quantity: 2,
          originalUnitPrice: new Prisma.Decimal('1160.00'),
          finalUnitPrice: new Prisma.Decimal('1160.00'),
          discountType: null,
          discountValue: null,
          belowFloor: false,
          discountReason: null,
          discountAppliedById: null,
          createdAt: new Date(),
        },
      ],
    });
    shopFindUniqueOrThrow.mockResolvedValue({
      companyId: 'company-1',
      company: { vatPct: 16 },
    });
    productFindMany.mockResolvedValue([]);
    serviceFindMany.mockResolvedValue([{ id: 'service-1' }]);
    orderCreate.mockResolvedValue({ id: 'order-1' });
    itemDeleteMany.mockResolvedValue({ count: 1 });
    cartUpdate.mockResolvedValue({ id: 'cart-1' });
    orderFindUniqueOrThrow.mockResolvedValue({ id: 'order-1' });

    await repository.checkout('shop-1', 'cart-1', 'user-1', 'counter-1');

    expect(orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subtotal: new Prisma.Decimal('2000.00'),
        vatAmount: new Prisma.Decimal('320.00'),
        total: new Prisma.Decimal('2320.00'),
        status: 'OPEN',
      }),
      select: { id: true },
    });
    expect(itemDeleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1' },
    });
    expect(cartUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          orderId: 'order-1',
          activeKey: null,
        }),
      }),
    );
  });
});
