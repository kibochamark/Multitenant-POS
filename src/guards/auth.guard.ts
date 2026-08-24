
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jose from 'jose'
import { PrismaService } from 'src/globalservices/prisma/prisma.service';


@Injectable()
export class AuthGuard implements CanActivate {
    private jwks: any; 
    
    constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) { 
        const issuer = config.get<string>('KINDE_ISSUER_URL');
        const audience = 'YOUR_API_AUDIENCE';
        this.jwks = jose.createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

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
            const payload:any = await jose.jwtVerify(token, this.jwks, {
                audience: 'YOUR_API_AUDIENCE',
                issuer: this.config.get<string>('KINDE_ISSUER_URL'),
            });
            // 💡 We're assigning the payload to the request object here
            // so that we can access it in our route handlers
            console.log('Payload:', payload);
            if (!payload.sub) {
                throw new UnauthorizedException('Token has no subject');
            }

            const user = await this.prisma.user.findUnique({
                where: {
                    kindeId: payload.sub,
                },
            });

            if (!user) {
                throw new UnauthorizedException('User is not registered');
            }

            request.user = {
                id: user.id,
                kindeId: user.kindeId,
                companyId: user.companyId,
                name: user.name,
                email: user.email,
            };
        } catch {
            throw new UnauthorizedException();
        }
        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
