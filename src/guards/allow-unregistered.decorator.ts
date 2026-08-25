import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNREGISTERED_KEY = 'allow-unregistered-kinde-user';

/**
 * Allows a verified Kinde identity through AuthGuard before a local User exists.
 * Use only for bootstrap endpoints such as GET /user/me and POST /user.
 */
export const AllowUnregistered = () =>
  SetMetadata(ALLOW_UNREGISTERED_KEY, true);
