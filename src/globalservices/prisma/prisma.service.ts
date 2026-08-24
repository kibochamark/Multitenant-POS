import { Global, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '../../../generated/prisma/client';


@Injectable()
export class PrismaService extends PrismaClient {
    constructor(config?:ConfigService) {
        
        const databaseUrl = config?.get<string>('DATABASE_URL')
        const adapter = new PrismaPg({
            connectionString: databaseUrl,
        })
        
        super({
            adapter,
        });
    }
}
