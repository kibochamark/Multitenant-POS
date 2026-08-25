import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { AllowUnregistered } from 'src/guards/allow-unregistered.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { AuthenticatedRequest } from 'src/types/authenticated-request.types';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  @Version('1')
  @AllowUnregistered()
  async createWorkspace(
    @Req() request: AuthenticatedRequest,
    @Body() data: CreateOnboardingDto,
  ) {
    const workspace = await this.onboardingService.createWorkspace(
      request.auth.kindeId,
      data,
    );

    return { status: 201, data: workspace, error: null };
  }
}
