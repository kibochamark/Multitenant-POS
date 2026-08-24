import { Injectable, Logger } from '@nestjs/common';
import { User, UserShopRole } from 'src/types/user.types';
import { UsersRepository } from './users.repository';
import { error } from 'console';

@Injectable()
export class UsersService {
    private logger = new Logger(UsersService.name)
    constructor(private readonly userrepo:UsersRepository){}

    async createuser(data:User) {

        try{
            this.logger.log("calling user repo to create user")

            const user = await this.userrepo.createUser(data)
            this.logger.log("user returned successfully {}", user)
            return {
                status:201,
                data:user,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
        
    }

    async finduserbyid(id:string){
        try{
            this.logger.log("calling user repo to find user by id")

            const user = await this.userrepo.findUserById(id)
            this.logger.log("user returned successfully")
            return {
                status:200,
                data:user,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }


    async findallusers(skip?:number, take?:number){
        try{
            this.logger.log("calling user repo to find all users")

            const users = await this.userrepo.findAllUsers(skip, take)
            this.logger.log("users returned successfully")
            return {
                status:200,
                data:users,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }

    async findusersbycompanyid(companyId:string, skip?:number, take?:number){
        try{
            this.logger.log("calling user repo to find users by company id")

            const users = await this.userrepo.findUsersByCompanyId(companyId, skip, take)
            this.logger.log("users returned successfully")
            return {
                status:200,
                data:users,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }

    async updateuser(id:string, data:Partial<User>){
        try{
            this.logger.log("calling user repo to update user")

            const user = await this.userrepo.updateUser(id, data)
            this.logger.log("user updated successfully")
            return {
                status:200,
                data:user,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }

    async deleteuser(id:string){
        try{
            this.logger.log("calling user repo to delete user")

            const user = await this.userrepo.deleteUser(id)
            this.logger.log("user deleted successfully")
            return {
                status:200,
                data:user,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }   


    // shop service methods for user shop roles
    async createusershoprole(data:UserShopRole){
        try{
            this.logger.log("calling user repo to create user shop role")

            const usershoprole = await this.userrepo.createUserShopRole(data)
            this.logger.log("user shop role created successfully")
            return {
                status:201,
                data:usershoprole,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }

    async findusershoprolebycompositeid(userId:string, shopId:string){
        try{
            this.logger.log("calling user repo to find user shop role by composite id")

            const usershoprole = await this.userrepo.findUserShopRoleByCompositeId(userId, shopId)
            this.logger.log("user shop role returned successfully")
            return {
                status:200,
                data:usershoprole,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }

    async updateusershoprolebycompositeid(userId:string, shopId:string, data:Partial<UserShopRole>){
        try{
            this.logger.log("calling user repo to update user shop role by composite id")

            const usershoprole = await this.userrepo.updateUserShopRoleByCompositeId(userId, shopId, data)
            this.logger.log("user shop role updated successfully")
            return {
                status:200,
                data:usershoprole,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }

    async deleteusershoprole(userId:string, shopId:string){
        try{
            this.logger.log("calling user repo to delete user shop role")

            const usershoprole = await this.userrepo.deleteUserShopRole(userId, shopId)
            this.logger.log("user shop role deleted successfully")
            return {
                status:200,
                data:usershoprole,
                error:null
            }
        }catch(e:any){
            return {
                status:500,
                error:e.message,
                data:null
            }
        }
    }


    
}
