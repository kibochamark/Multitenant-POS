import { Module } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, AuthGuard],
})
export class OnboardingModule {}
