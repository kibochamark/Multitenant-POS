import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/globalservices/prisma/prisma.service";
import { User, UserShopRole } from "src/types/user.types";



@Injectable()
export class UsersRepository {
    // Implement repository methods here
    private readonly logger = new Logger(UsersRepository.name);

    constructor(private readonly prismaService: PrismaService) {}

    async createUser(data: any): Promise<User> {
        this.logger.log("Creating user...")
        try {
            const user = await this.prismaService.user.create({ data });
            this.logger.log("User created successfully")
            return user;
        } catch (error) {
            this.logger.error("Error creating user", error);
            throw error;
        }
    }

    async findUserById(id: string): Promise<any> {
        try {
            this.logger.log(`Finding user with ID: ${id}`);
            const user = await this.prismaService.user.findUnique({ where: { id } });
            if (!user) {
                this.logger.warn(`User with ID: ${id} not found`);
                return null;
            }
            this.logger.log(`User with ID: ${id} found successfully`);
            return user;
        } catch (error) {
            this.logger.error(`Error finding user with ID: ${id}`, error);
            throw error;
        }
    }


    async findAllUsers(skip?: number, take?: number): Promise<User[]> {
        try {
            this.logger.log(`Finding all users with skip: ${skip}, take: ${take}`);
            const users = await this.prismaService.user.findMany({ skip, take , include:{
                company:true
            }},);
            this.logger.log(`Found ${users.length} users successfully`);
            return users;
        } catch (error) {
            this.logger.error("Error finding all users", error);
            throw error;
        }
    }

    async findUsersByCompanyId(companyId: string, skip?: number, take?: number): Promise<User[]> {
        try {
            this.logger.log(`Finding users with companyId: ${companyId}, skip: ${skip}, take: ${take}`);
            const users = await this.prismaService.user.findMany({ where: { companyId }, skip, take });
            this.logger.log(`Found ${users.length} users for companyId: ${companyId} successfully`);
            return users;
        } catch (error) {
            this.logger.error(`Error finding users with companyId: ${companyId}`, error);
            throw error;
        }
    }

    async updateUser(id: string, data: Partial<User>): Promise<User> {
        try {
            this.logger.log(`Updating user with ID: ${id}`);
            const user = await this.prismaService.user.update({ where: { id }, data });
            this.logger.log(`User with ID: ${id} updated successfully`);
            return user;
        } catch (error) {
            this.logger.error(`Error updating user with ID: ${id}`, error);
            throw error;
        }
    }

    async deleteUser(id: string): Promise<any> {
        try {
            this.logger.log(`Deleting user with ID: ${id}`);
            const user = await this.prismaService.user.delete({ where: { id } });
            this.logger.log(`User with ID: ${id} deleted successfully`);
            return user;
        } catch (error) {
            this.logger.error(`Error deleting user with ID: ${id}`, error);
            throw error;
        }
    }


    //Create and assign users to shops with roles

    async createUserShopRole(data: UserShopRole): Promise<UserShopRole> {
        try {
            this.logger.log("Creating user shop role...")
            const userShopRole = await this.prismaService.userShopRole.create({ data });
            this.logger.log("User shop role created successfully")
            return userShopRole;
        } catch (error) {
            this.logger.error("Error creating user shop role", error);
            throw error;
        }   
    }

    async findUserShopRoleByCompositeId(userId: string, shopId: string): Promise<UserShopRole | null> {
        try {
            this.logger.log(`Finding user shop role with composite ID: ${userId}-${shopId}`);
            const userShopRole = await this.prismaService.userShopRole.findUnique({ where: { userId_shopId: { userId, shopId } } });
            if (!userShopRole) {
                this.logger.warn(`User shop role with composite ID: ${userId}-${shopId} not found`);
                return null;
            }
            this.logger.log(`User shop role with composite ID: ${userId}-${shopId} found successfully`);
            return userShopRole;
        } catch (error) {
            this.logger.error(`Error finding user shop role with composite ID: ${userId}-${shopId}`, error);
            throw error;
        }
    }

    async updateUserShopRoleByCompositeId(userId: string, shopId: string, data: Partial<UserShopRole>): Promise<UserShopRole> {
        try {
            this.logger.log(`Updating user shop role with composite ID: ${userId}-${shopId}`);
            const userShopRole = await this.prismaService.userShopRole.update({ where: { userId_shopId: { userId, shopId } }, data });
            this.logger.log(`User shop role with composite ID: ${userId}-${shopId} updated successfully`);
            return userShopRole;
        } catch (error) {
            this.logger.error(`Error updating user shop role with composite ID: ${userId}-${shopId}`, error);
            throw error;
        }
    }

    async deleteUserShopRole(userId: string, shopId: string): Promise<UserShopRole> {
        try {
            this.logger.log(`Deleting user shop role with composite ID: ${userId}-${shopId}`);
            const userShopRole = await this.prismaService.userShopRole.delete({ where: { userId_shopId: { userId, shopId } } });
            this.logger.log(`User shop role with composite ID: ${userId}-${shopId} deleted successfully`);
            return userShopRole;
        } catch (error) {
            this.logger.error(`Error deleting user shop role with composite ID: ${userId}-${shopId}`, error);
            throw error;
        }
    }






}