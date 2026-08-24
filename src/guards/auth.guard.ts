import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jose from 'jose';
import { PrismaService } from 'src/globalservices/prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof jose.createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.issuer = config.getOrThrow<string>('KINDE_ISSUER_URL');
    // this.audience = config.getOrThrow<string>('KINDE_AUDIENCE');
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
        audience: this.audience,
        issuer: this.issuer,
      });

      console.log('JWT payload:', payload);
      if (!payload.sub) {
        throw new UnauthorizedException('Token has no subject');
      }

      console.log('Looking for user with kindeId:', payload.sub);
      const user = await this.prisma.user.findUnique({
        where: {
          kindeId: payload.sub as string,
        },
      });


      console.log('User found in database:', user);

      if (!user) {
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
