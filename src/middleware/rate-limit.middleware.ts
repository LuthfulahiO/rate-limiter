import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../utils/RateLimiter';
import { Redis } from 'ioredis';
import { ClientService } from '../client/client.service';
import { Client } from '../client/entities/client.entity';

@Injectable()
export class RateLimitMiddleware {
  private readonly rateLimiter: RateLimiter;
  private readonly redisClient: Redis;
  private readonly clientDataPrefix: string;

  constructor(
    redisClient: Redis,
    private readonly clientService: ClientService,
  ) {
    // NOTE(@Luthfulahi): This is a global request limit for the entire system should be determined based on the number of clients, capacity of the server and desired performance
    const globalRequestLimit = 1000;
    this.rateLimiter = new RateLimiter(redisClient, globalRequestLimit);
    this.redisClient = redisClient;
    this.clientDataPrefix = 'client-data:';
  }

  private async getClientDataFromCache(clientId: string) {
    const clientData = await this.redisClient.get(
      `${this.clientDataPrefix}${clientId}`,
    );

    return clientData ? JSON.parse(clientData) : null;
  }

  private async setClientDataToCache(clientId: string, clientData: any) {
    const key = `${this.clientDataPrefix}${clientId}`;
    const clientDataJson = JSON.stringify(clientData);

    const cacheExpirationTime = 60 * 60;

    await this.redisClient.setex(key, cacheExpirationTime, clientDataJson);
  }

  handler() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.header('x-client-id');

      if (!clientId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const clientData = await this.getClientDataFromCache(clientId);

      let client: Client;
      if (clientData) {
        client = clientData;
      } else {
        client = await this.clientService.findOne(clientId);
        if (client) {
          await this.setClientDataToCache(clientId, client);
        }
      }

      if (!client) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      if (!client) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const requestTimestamp = Date.now();
      const { allowed, limitType, retryAfter } =
        await this.rateLimiter.isRequestAllowed(client, requestTimestamp);

      if (allowed) {
        next();
      } else {
        let message: string;
        switch (limitType) {
          case 'global':
            message = 'Global Request Limit Exceeded';
            break;
          case 'second':
            message = 'Too Many Requests per Second';
            break;
          case 'month':
            message = 'Monthly Request Limit Exceeded';
            break;
        }
        res
          .status(429)
          .header(
            'Retry-After',
            retryAfter ? Math.ceil(retryAfter / 1000).toString() : undefined,
          )
          .json({ message });
      }
    };
  }
}
