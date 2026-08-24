import { Body, Controller, Delete, Get, HttpCode, HttpException, Param, Patch, Post, Version } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyDTO } from 'src/types/dto/company.dto';

@Controller('company')
export class CompanyController {
    constructor(private readonly companyService: CompanyService) {}


    @Post()
    @Version('1')
    @HttpCode(201)
    async createCompany(@Body() companyData: CompanyDTO) {
        try {
            const createdCompany = await this.companyService.createCompany(companyData);
            if (createdCompany.status === 201) {
                return {
                    status: 201,
                    data: createdCompany.data,
                    error: null
                };
            } else {
                throw new HttpException(createdCompany.error, createdCompany.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }


    @Get('all/:id')
    @Version('1')
    @HttpCode(200)
    async findCompanyById(@Param('id') id: string) {
        try {
            const company = await this.companyService.findCompanyById(id);
            if (company.status === 200) {
                return {
                    status: 200,
                    data: company.data,
                    error: null
                };
            } else {
                throw new HttpException(company.error, company.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }


    @Get("all")
    @Version('1')
    @HttpCode(200)
    async findAllCompanies(@Param('skip') skip?: number, @Param('take') take?: number) {
        try {
            const companies = await this.companyService.findAllCompanies(skip, take);
            if (companies.status === 200) {
                return {
                    status: 200,
                    data: companies.data,
                    error: null
                };
            } else {
                throw new HttpException(companies.error, companies.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Patch(':id')
    @Version('1')
    @HttpCode(200)
    async updateCompany(@Param('id') id: string, @Body() companyData: Partial<CompanyDTO>) {
        try {
            const updatedCompany = await this.companyService.updateCompany(id, companyData);
            if (updatedCompany.status === 200) {
                return {
                    status: 200,
                    data: updatedCompany.data,
                    error: null
                };
            } else {
                throw new HttpException(updatedCompany.error, updatedCompany.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }


    @Delete(':id')
    @Version('1')
    @HttpCode(200)
    async deleteCompany(@Param('id') id: string) {
        try {
            const deletedCompany = await this.companyService.deleteCompany(id);
            if (deletedCompany.status === 200) {
                return {
                    status: 200,
                    data: deletedCompany.data,
                    error: null
                };
            } else {
                throw new HttpException(deletedCompany.error, deletedCompany.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }


    @Post('shop/:parentCompanyId')
    @Version('1')
    async createShop(@Param('parentCompanyId') parentCompanyId: string, @Body() shopData: CompanyDTO) {
        try {
            const createdShop = await this.companyService.createShop(shopData, parentCompanyId);
            if (createdShop.status === 200) {
                return {
                    status: 200,
                    data: createdShop.data,
                    error: null
                };
            } else {
                throw new HttpException(createdShop.error, createdShop.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }


    @Get('shop/all/:id')
    @Version('1')
    async findShopById(@Param('id') id: string) {
        try {
            const shop = await this.companyService.findShopById(id);
            if (shop.status === 200) {
                return {
                    status: 200,
                    data: shop.data,
                    error: null
                };
            } else {
                throw new HttpException(shop.error, shop.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Patch('shop/:id')
    @Version('1')
    async updateShop(@Param('id') id: string, @Body() shopData: Partial<CompanyDTO>) {
        try {
            const updatedShop = await this.companyService.updateShop(id, shopData);
            if (updatedShop.status === 200) {
                return {
                    status: 200,
                    data: updatedShop.data,
                    error: null
                };
            } else {
                throw new HttpException(updatedShop.error, updatedShop.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Delete('shop/:id')
    @Version('1')
    async deleteShop(@Param('id') id: string) {
        try {
            const deletedShop = await this.companyService.deleteShop(id);
            if (deletedShop.status === 200) {
                return {
                    status: 200,
                    data: deletedShop.data,
                    error: null
                };
            } else {
                throw new HttpException(deletedShop.error, deletedShop.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Get('shops/all')
    @Version('1')
    async findAllShops(@Param('skip') skip?: number, @Param('take') take?: number) {
        try {
            const shops = await this.companyService.findAllShops(skip, take);
            if (shops.status === 200) {
                return {
                    status: 200,
                    data: shops.data,
                    error: null
                };
            } else {
                throw new HttpException(shops.error, shops.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Get('shops/company/:companyId')
    @Version('1')
    async findShopsByCompanyId(@Param('companyId') companyId: string, @Param('skip') skip?: number, @Param('take') take?: number) {
        try {
            const shops = await this.companyService.findShopsByCompanyId(companyId, skip, take);
            if (shops.status === 200) { 
                return {
                    status: 200,
                    data: shops.data,
                    error: null
                };
            } else {
                throw new HttpException(shops.error, shops.status);
            }
        } catch (e:any) {
            throw new HttpException(e.message, 500);
        }
    }

}
