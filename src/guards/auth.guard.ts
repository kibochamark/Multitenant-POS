import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jose from 'jose';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';
import { ALLOW_UNREGISTERED_KEY } from './allow-unregistered.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof jose.createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience?: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {
    this.issuer = config.getOrThrow<string>('KINDE_ISSUER_URL');
    this.audience = config.get<string>('KINDE_AUDIENCE');
    this.jwks = jose.createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      // 💡 Here the JWT secret key that's used for verifying the payload
      // is the key that was passed in the JwtModule
      const { payload } = await jose.jwtVerify(token, this.jwks, {
        ...(this.audience ? { audience: this.audience } : {}),
        issuer: this.issuer,
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Token has no subject');
      }

      request.auth = {
        kindeId: payload.sub,
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      };

      const user = await this.prisma.user.findUnique({
        where: {
          kindeId: payload.sub,
        },
      });

      if (!user) {
        const allowUnregistered = this.reflector.getAllAndOverride<boolean>(
          ALLOW_UNREGISTERED_KEY,
          [context.getHandler(), context.getClass()],
        );
        if (allowUnregistered) {
          return true;
        }
        throw new UnauthorizedException('User is not registered');
      }

      request.user = {
        id: user.id,
        kindeId: user.kindeId,
        companyId: user.companyId,
        name: user.name,
        email: user.email,
        defaultOwner: user.defaultOwner,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
