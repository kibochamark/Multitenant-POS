import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { AuthGuard } from 'src/guards/auth.guard';

@Module({
  providers: [UsersService, UsersRepository, AuthGuard],
  controllers: [UsersController],
})
export class UsersModule {}
