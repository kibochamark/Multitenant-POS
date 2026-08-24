import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { Company } from 'src/types/company.types';

@Injectable()
export class CompanyRepo {
    private logger = new Logger(CompanyRepo.name);

    constructor( private readonly prismaService: PrismaService) {}

    
    async createCompany(data: Company): Promise<Company> {
        let modifiedData = { ...data };
        if (modifiedData.vatPct === undefined) {
            modifiedData.vatPct = 0;
        }
        if (modifiedData.defaultMinMarginPct === undefined) {
            modifiedData.defaultMinMarginPct = 0;
        }
        if (modifiedData.globalDiscountPct === undefined) {
            modifiedData.globalDiscountPct = 0;
        }

        modifiedData.metadata = modifiedData.metadata || {};
        modifiedData.vatPct = parseFloat(modifiedData.vatPct as any);
        modifiedData.defaultMinMarginPct = parseFloat(modifiedData.defaultMinMarginPct as any);
        modifiedData.globalDiscountPct = parseFloat(modifiedData.globalDiscountPct as any);

        this.logger.log("Creating company...")

        return await this.prismaService.company.create({ 
            data:{
                ...modifiedData
            }
         });
    }

    async findCompanyById(id: string): Promise<Company | null  > {
        this.logger.log(`Finding company with ID: ${id}`);
        return this.prismaService.company.findUnique({ where: { id } });
    }

    async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
        let modifiedData = { ...data };
        if (modifiedData.vatPct) {
            modifiedData.vatPct = parseFloat(modifiedData.vatPct as any);
        }
        if (modifiedData.defaultMinMarginPct) {
            modifiedData.defaultMinMarginPct = parseFloat(modifiedData.defaultMinMarginPct as any);
        }
        if (modifiedData.globalDiscountPct) {
            modifiedData.globalDiscountPct = parseFloat(modifiedData.globalDiscountPct as any);
        }

        this.logger.log(`Updating company with ID: ${id}`);
        return this.prismaService.company.update({ where: { id }, data });
    }

    async deleteCompany(id: string): Promise<Company> {
        return this.prismaService.company.delete({ where: { id } });
    }


    async findAllCompanies(skip?: number, take?: number): Promise<Company[]> {
        this.logger.log(`Finding all companies with skip: ${skip}, take: ${take}`);
        return this.prismaService.company.findMany({ skip, take });
    }


    // A SHOP IS A MINI COMPANY.WE WILL HAVE CALLS TO THE SHOP TABLE HERE
    
    async createShop(data: Company, parentCompanyId: string): Promise<Company> {
        let modifiedData = { ...data };
        if (modifiedData.vatPct === undefined) {
            modifiedData.vatPct = 0;
        }
        if (modifiedData.defaultMinMarginPct === undefined) {
            modifiedData.defaultMinMarginPct = 0;
        }
        if (modifiedData.globalDiscountPct === undefined) {
            modifiedData.globalDiscountPct = 0;
        }

        modifiedData.metadata = modifiedData.metadata || {};
        modifiedData.vatPct = parseFloat(modifiedData.vatPct as any);
        modifiedData.defaultMinMarginPct = parseFloat(modifiedData.defaultMinMarginPct as any);
        modifiedData.globalDiscountPct = parseFloat(modifiedData.globalDiscountPct as any);

        this.logger.log("Creating shop...")

        return await this.prismaService.shop.create({ 
            data:{
                ...modifiedData,
                companyId: parentCompanyId
            }
         });
    }


    async findShopById(id: string): Promise<Company | null  > {
        this.logger.log(`Finding shop with ID: ${id}`);
        return this.prismaService.shop.findUnique({ where: { id } });
    }

    async updateShop(id: string, data: Partial<Company>): Promise<Company> {
        let modifiedData = { ...data };
        if (modifiedData.vatPct) {
            modifiedData.vatPct = parseFloat(modifiedData.vatPct as any);
        }
        if (modifiedData.defaultMinMarginPct) {
            modifiedData.defaultMinMarginPct = parseFloat(modifiedData.defaultMinMarginPct as any);
        }
        if (modifiedData.globalDiscountPct) {
            modifiedData.globalDiscountPct = parseFloat(modifiedData.globalDiscountPct as any);
        }

        this.logger.log(`Updating shop with ID: ${id}`);
        return this.prismaService.shop.update({ where: { id }, data });
    }

    async deleteShop(id: string): Promise<Company> {
        return this.prismaService.shop.delete({ where: { id } });
    }

    async findAllShops(skip?: number, take?: number): Promise<Company[]> {
        this.logger.log(`Finding all shops with skip: ${skip}, take: ${take}`);
        return this.prismaService.shop.findMany({ skip, take });
    }

    async findShopsByCompanyId(companyId: string, skip?: number, take?: number): Promise<Company[]> {
        this.logger.log(`Finding shops with companyId: ${companyId}, skip: ${skip}, take: ${take}`);
        return this.prismaService.shop.findMany({ where: { companyId }, skip, take });
    }

    
}
