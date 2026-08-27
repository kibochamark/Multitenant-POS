import { AccountPurpose, AccountingEventType, JournalSide, PaymentMethod } from 'generated/prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

const MONEY = /^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/;

export class ManualJournalLineDto {
  @IsEnum(AccountPurpose) purpose: AccountPurpose;
  @IsEnum(JournalSide) side: JournalSide;
  @Matches(MONEY) amount: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

export class CreateManualJournalDto {
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey: string;
  @IsIn([AccountingEventType.OPENING_BALANCE, AccountingEventType.MANUAL_ADJUSTMENT])
  eventType: AccountingEventType;
  @IsString() @MinLength(3) @MaxLength(500) description: string;
  @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => ManualJournalLineDto)
  lines: ManualJournalLineDto[];
}

export class RecordUnallocatedInventoryPurchaseDto {
  @IsString() @MinLength(8) @MaxLength(100) idempotencyKey: string;
  @Matches(MONEY) amount: string;
  @IsIn([PaymentMethod.CASH, PaymentMethod.MPESA]) paymentMethod: PaymentMethod;
  @IsString() @MinLength(3) @MaxLength(500) description: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}
