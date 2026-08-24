import { Request } from 'express';

export type ShopRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface AuthenticatedUser {
  id: string;
  kindeId: string;
  companyId: string;
  name: string;
  email: string;
  defaultOwner: boolean;
}

export interface ShopAccessContext {
  shopId: string;
  role: ShopRole | null;
  ownerBypass: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  shopAccess?: ShopAccessContext;
}
