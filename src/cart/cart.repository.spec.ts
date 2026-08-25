import { NotFoundException } from '@nestjs/common';
import { CartRepository } from './cart.repository';

describe('CartRepository', () => {
  const productFindUnique = jest.fn();
  const productFindMany = jest.fn();
  const cartUpsert = jest.fn();
  const cartUpdate = jest.fn();
  const cartFindUniqueOrThrow = jest.fn();
  const itemUpsert = jest.fn();
  const tx = {
    product: { findUnique: productFindUnique, findMany: productFindMany },
    cart: {
      upsert: cartUpsert,
      update: cartUpdate,
      findUniqueOrThrow: cartFindUniqueOrThrow,
    },
    cartItem: { upsert: itemUpsert },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const repository = new CartRepository(prisma as never);

  beforeEach(() => jest.clearAllMocks());

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
});
