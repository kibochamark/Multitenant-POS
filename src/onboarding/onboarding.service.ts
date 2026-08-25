import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(kindeId: string, data: CreateOnboardingDto) {
    return this.prisma.$transaction(
      async (transaction) => {
        const existingUser = await transaction.user.findUnique({
          where: { kindeId },
          select: { id: true },
        });

        if (existingUser) {
          throw new ConflictException('This account has already been set up');
        }

        const company = await transaction.company.create({
          data: {
            name: data.companyName,
            vatPct: data.vatPct,
          },
          select: { id: true, name: true },
        });

        const shop = await transaction.shop.create({
          data: {
            companyId: company.id,
            name: data.shopName,
            vatPct: data.vatPct,
            metadata: { location: data.location },
          },
          select: {
            id: true,
            companyId: true,
            name: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const user = await transaction.user.create({
          data: {
            companyId: company.id,
            kindeId,
            name: data.name,
            email: data.email,
            defaultOwner: true,
          },
          select: {
            id: true,
            companyId: true,
            kindeId: true,
            name: true,
            email: true,
            phone: true,
            defaultOwner: true,
          },
        });

        const membership = await transaction.userShopRole.create({
          data: {
            userId: user.id,
            shopId: shop.id,
            role: 'OWNER',
          },
          select: { id: true, userId: true, shopId: true, role: true },
        });

        return {
          user,
          company,
          shops: [{ ...shop, role: membership.role }],
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
