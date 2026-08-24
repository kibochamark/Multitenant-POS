import {IsEmail, IsOptional, IsString} from "class-validator"
import { UserShopRole } from "../user.types"

export class CreateUserDTO {
    @IsString()
    companyId: string

    @IsString()
    kindeId: string

    @IsString()
    name: string

    @IsString()
    @IsEmail()
    email: string

    @IsString()
    @IsOptional()
    phone?: string
}



export class UserShopRoleDTO {
    @IsString()
    userId: string

    @IsString()
    shopId: string

    @IsString()
    role: "OWNER" | "MANAGER" | "CASHIER"
}