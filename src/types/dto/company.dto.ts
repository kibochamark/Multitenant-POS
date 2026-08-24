import {IsEmail, IsJSON, IsNumber, IsOptional, IsString} from "class-validator"

export class CompanyDTO {
   
    @IsString()
    name: string    

    @IsNumber()
    @IsOptional()
    vatPct?: number

    @IsNumber()
    @IsOptional()
    defaultMinMarginPct?: number


    @IsNumber()
    @IsOptional()
    gloabalDiscountPct?: number

    @IsJSON()
    @IsOptional()
    metadata?: any
}
