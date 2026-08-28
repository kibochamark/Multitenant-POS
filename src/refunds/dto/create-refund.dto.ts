import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const money = /^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/;

export class RefundLineDto {
  @IsUUID() orderLineItemId!: string;
  @IsInt() @Min(1) quantity!: number;
  @Matches(money, { message: 'refundAmount must be greater than zero with at most 2 decimal places' }) refundAmount!: string;
  @IsIn(['RESTOCK', 'DAMAGED', 'NOT_RETURNED']) disposition!: 'RESTOCK' | 'DAMAGED' | 'NOT_RETURNED';
}

export class RefundAllocationDto {
  @IsIn(['CASH', 'MPESA', 'CREDIT']) method!: 'CASH' | 'MPESA' | 'CREDIT';
  @Matches(money, { message: 'allocation amount must be greater than zero with at most 2 decimal places' }) amount!: string;
  @IsOptional() @IsString() @MaxLength(100) referenceCode?: string;
}

export class CreateRefundDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RefundLineDto) lines!: RefundLineDto[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RefundAllocationDto) allocations!: RefundAllocationDto[];
}
