import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const config: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT as string) || 5432,
  username: process.env.DB_USERNAME || 'your-username',
  password: process.env.DB_PASSWORD || 'your-password',
  database: process.env.DB_DATABASE || 'rate_limiter',
  synchronize: true,
  logging: false,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: ['src/migration/**/*.ts'],
  subscribers: ['src/subscriber/**/*.ts'],
};

export default config;
