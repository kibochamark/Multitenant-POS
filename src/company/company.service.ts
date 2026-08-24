import { Injectable } from '@nestjs/common';
import { CompanyRepo } from './company.repository';
import { Company } from 'src/types/company.types';

@Injectable()
export class CompanyService {
    constructor(private readonly companyRepo: CompanyRepo) {}



    async createCompany(data: Company) {
        try {
            const company = await this.companyRepo.createCompany(data);
            return {
                status: 200,
                data: company,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async findCompanyById(id: string) {
        try {
            const company = await this.companyRepo.findCompanyById(id);
            if (!company) {
                return {
                    status: 404,
                    error: 'Company not found',
                    data: null
                };
            }
            return {
                status: 200,
                data: company,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async updateCompany(id: string, data: Partial<Company>) {
        try {
            const company = await this.companyRepo.updateCompany(id, data);
            return {
                status: 200,
                data: company,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }  
    }


    async deleteCompany(id: string) {
        try {
            const company = await this.companyRepo.deleteCompany(id);
            return {
                status: 200,
                data: company,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async findAllCompanies(skip?: number, take?: number) {
        try {
            const companies = await this.companyRepo.findAllCompanies(skip, take);
            return {
                status: 200,
                data: companies,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }


    // a shop is a mini company, so we can use the same service to manage shops as well. The only difference is that a shop will have a parent company, so we can add a parentCompanyId field to the shop entity and use it to find all shops for a given company.
    async createShop(data: Company, parentCompanyId: string) {
        try {
            const shop = await this.companyRepo.createShop(data, parentCompanyId);
            return {
                status: 200,
                data: shop,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async findShopById(id: string) {
        try {
            const shop = await this.companyRepo.findShopById(id);
            if (!shop) {
                return {
                    status: 404,
                    error: 'Shop not found',
                    data: null
                };
            }
            return {
                status: 200,
                data: shop,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async updateShop(id: string, data: Partial<Company>) {
        try {
            const shop = await this.companyRepo.updateShop(id, data);
            return {
                status: 200,
                data: shop,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async deleteShop(id: string) {
        try {
            const shop = await this.companyRepo.deleteShop(id);
            return {
                status: 200,
                data: shop,
                error: null
            };
        }catch (e: any) {    
        return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async findAllShops(skip?: number, take?: number) {
        try {
            const shops = await this.companyRepo.findAllShops(skip, take);
            return {
                status: 200,
                data: shops,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }

    async findShopsByCompanyId(companyId: string, skip?: number, take?: number) {
        try {
            const shops = await this.companyRepo.findShopsByCompanyId(companyId, skip, take);
            return {
                status: 200,
                data: shops,
                error: null
            };
        } catch (e: any) {
            return {
                status: 500,
                error: e.message,
                data: null
            };
        }
    }
}
