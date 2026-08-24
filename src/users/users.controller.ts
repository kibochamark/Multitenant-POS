import { Body, Controller, Get, HttpCode, HttpException, Param, Patch, Post, UseGuards, Version } from '@nestjs/common';
import { CreateUserDTO, UserShopRoleDTO } from 'src/types/dto/user.dto';
import { UsersService } from './users.service';
import { AuthGuard } from 'src/guards/auth.guard';

@Controller('user')
@UseGuards(AuthGuard)
export class UsersController {
    constructor(private readonly userservice:UsersService){

    }

    @Post()
    @Version('1')
    async createUser(@Body() createUserDTO: CreateUserDTO){
        try{
            const createduser = await this.userservice.createuser(createUserDTO)
            if (createduser.status === 201) {
                return {
                    status:201,
                    data:createduser?.data,
                    error:null
                }
            } else{
                throw new HttpException(createduser.error, createduser.status)
            }
        
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }


    @Get('all')
    @Version('1')
    async findAllUsers(@Param('skip') skip?:number, @Param('take') take?:number){
        try
        {
            const users = await this.userservice.findallusers(skip, take)
            if (users.status === 200) {
                return {
                    status:200,
                    data:users?.data,
                    error:null
                }
            } else{
                throw new HttpException(users.error, users.status)
            }
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }

    @Get('all/:id')
    @Version('1')
    async findUserById(@Param('id') id:string){
        try{
            const user = await this.userservice.finduserbyid(id)
            if (user.status === 200) {
                return {
                    status:200,
                    data:user?.data,
                    error:null
                }
            } else{
                throw new HttpException(user.error, user.status)
            }
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }


    @Get('company/:companyId')
    @Version('1')
    @HttpCode(200)
    async findUsersByCompanyId(@Param('companyId') companyId:string, @Param('skip') skip?:number, @Param('take') take?:number){
        try {

            const users = await this.userservice.findusersbycompanyid(companyId, skip, take)
            if (users.status === 200) {
                return {
                    status:200,
                    data:users?.data,
                    error:null
                }
            } else{
                throw new HttpException(users.error, users.status)
            }
        }
        catch(e:any){
            throw new HttpException(e.message, 500)
        }   
    }


    @Patch(':id')
    @Version('1')
    @HttpCode(200)
    async updateUser(@Param('id') id:string, @Body() updateUserDTO: Partial<CreateUserDTO>){
        try{
            const updateduser = await this.userservice.updateuser(id, updateUserDTO)
            if (updateduser.status === 200) {
                return {
                    status:200,
                    data:updateduser?.data,
                    error:null
                }
            } else{
                throw new HttpException(updateduser.error, updateduser.status)
            }
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }


    // shop role management endpoints
    @Post('shop-role')
    @Version('1')
    async createUserShopRole(@Body() data: UserShopRoleDTO){
        try{
            const createdRole = await this.userservice.createusershoprole(data)
            if (createdRole.status === 201) {
                return {
                    status:201,
                    data:createdRole?.data,
                    error:null
                }
            } else{
                throw new HttpException(createdRole.error, createdRole.status)
            }   
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }

    @Get('shop-role/:userId/:shopId')
    @Version('1')
    async findUserShopRoleByCompositeId(@Param('userId') userId:string, @Param('shopId') shopId:string){
        try{
            const role = await this.userservice.findusershoprolebycompositeid(userId, shopId)
            if (role.status === 200) {
                return {
                    status:200,
                    data:role?.data,
                    error:null
                }
            } else{
                throw new HttpException(role.error, role.status)
            }
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }

    @Patch('shop-role/:userId/:shopId')
    @Version('1')
    async updateUserShopRoleByCompositeId(@Param('userId') userId:string, @Param('shopId') shopId:string, @Body() data: Partial<UserShopRoleDTO>){
        try{
            const updatedRole = await this.userservice.updateusershoprolebycompositeid(userId, shopId, data)
            if (updatedRole.status === 200) {
                return {
                    status:200,
                    data:updatedRole?.data,
                    error:null
                }
            } else{
                throw new HttpException(updatedRole.error, updatedRole.status)
            }
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }

    @HttpCode(200)
    @Patch('shop-role/:userId/:shopId/delete')
    @Version('1')
    async deleteUserShopRole(@Param('userId') userId:string, @Param('shopId') shopId:string){
        try{
            const deletedRole = await this.userservice.deleteusershoprole(userId, shopId)
            if (deletedRole.status === 200) {
                return {
                    status:200,
                    data:deletedRole?.data,
                    error:null
                }
            } else{
                throw new HttpException(deletedRole.error, deletedRole.status)
            }
        }catch(e:any){
            throw new HttpException(e.message, 500)
        }
    }
}
