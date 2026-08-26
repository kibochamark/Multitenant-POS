import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AdministrationRepository } from './administration.repository';
import { ChangeMembershipDto, ChangeUserStatusDto, CreateManagedShopDto } from './dto/administration.dto';

@Injectable()
export class AdministrationService {
  constructor(private readonly repository: AdministrationRepository) {}
  private owner(user: { companyId: string; defaultOwner: boolean }, companyId: string) {
    if (!user.defaultOwner || user.companyId !== companyId) throw new ForbiddenException('Only the company owner can perform this action');
  }
  private async manager(user: { id: string; companyId: string; defaultOwner: boolean }, companyId: string) {
    if (user.companyId !== companyId || (!user.defaultOwner && !(await this.repository.isCompanyManager(user.id, companyId)))) throw new ForbiddenException('Only a company owner or manager can perform this action');
  }
  async createShop(user: { id: string; companyId: string; defaultOwner: boolean }, companyId: string, data: CreateManagedShopDto) { await this.manager(user, companyId); return this.repository.createShop(companyId, data); }
  async companyDashboard(user: { id: string; companyId: string; defaultOwner: boolean }, companyId: string) { await this.manager(user, companyId); return this.repository.companyDashboard(companyId); }
  users(user: { companyId: string; defaultOwner: boolean }, companyId: string) { this.owner(user, companyId); return this.repository.listUsers(companyId); }
  async status(user: { id: string; companyId: string; defaultOwner: boolean }, companyId: string, userId: string, data: ChangeUserStatusDto) {
    this.owner(user, companyId);
    if (user.id === userId) throw new ConflictException('You cannot deactivate your own owner account');
    try { return await this.repository.setUserStatus(companyId, userId, data.isActive); } catch { throw new NotFoundException('Managed user not found'); }
  }
  async membership(user: { companyId: string; defaultOwner: boolean }, companyId: string, userId: string, shopId: string, data: ChangeMembershipDto) {
    this.owner(user, companyId); const result = await this.repository.setMembership(companyId, userId, shopId, data.role); if (!result) throw new NotFoundException('User or shop not found'); return result;
  }
  async removeMembership(user: { companyId: string; defaultOwner: boolean }, companyId: string, userId: string, shopId: string) {
    this.owner(user, companyId); const result = await this.repository.removeMembership(companyId, userId, shopId); if (!result.count) throw new NotFoundException('Shop assignment not found'); return { removed: true };
  }
  dashboard(shopId: string) { return this.repository.dashboard(shopId); }
}
