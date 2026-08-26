import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateManagedShopDto {
  @IsString() @MinLength(2) @MaxLength(150) name: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatPct?: number;
  @IsOptional() @IsNumber() @Min(0) defaultMinMarginPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) globalDiscountPct?: number;
}

export class ChangeUserStatusDto { @IsBoolean() isActive: boolean; }
export class ChangeMembershipDto { @IsIn(['OWNER', 'MANAGER', 'CASHIER']) role: 'OWNER' | 'MANAGER' | 'CASHIER'; }
