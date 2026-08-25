import { IsEmail, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateOnboardingDto {
  @IsString()
  companyName: string;

  @IsString()
  shopName: string;

  @IsString()
  location: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  vatPct: number;

  @IsString()
  name: string;

  @IsEmail()
  email: string;
}
