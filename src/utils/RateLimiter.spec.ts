import { Redis, RedisKey, Callback } from 'ioredis';
import { RateLimiter } from './RateLimiter';
import { Client } from '../client/entities/client.entity';

class MockRedis extends Redis {
  data: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    const value = this.data.get(key);
    return value === undefined ? null : value;
  }

  async set(
    key: RedisKey,
    value: string | number | Buffer,
    ...args: any[]
  ): Promise<'OK'> {
    this.data.set(key as string, value.toString());
    if (typeof args[args.length - 1] === 'function') {
      (args[args.length - 1] as Callback<'OK'>)(null, 'OK');
    }
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const value = parseInt(this.data.get(key) || '0', 10);
    this.data.set(key, (value + 1).toString());
    return value + 1;
  }
}

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let redisClient: Redis;

  beforeEach(() => {
    redisClient = new MockRedis();
    rateLimiter = new RateLimiter(redisClient, 10);
  });

  test('should allow a request within the global, second, and month limits', async () => {
    const client = new Client();
    client.clientId = 'client1';
    client.limitPerSecond = 5;
    client.limitPerMonth = 100;

    const result = await rateLimiter.isRequestAllowed(client, Date.now());

    expect(result.allowed).toBe(true);
    expect(result.limitType).toBe(null);
  });

  test('should not allow a request exceeding the global limit', async () => {
    const client = new Client();
    client.clientId = 'client2';
    client.limitPerSecond = 5;
    client.limitPerMonth = 100;

    for (let i = 0; i < 10; i++) {
      await rateLimiter.isRequestAllowed(client, Date.now());
    }

    const result = await rateLimiter.isRequestAllowed(client, Date.now());

    expect(result.allowed).toBe(false);
    expect(result.limitType).toBe('global');
    expect(result.retryAfter).toBeDefined();
  });

  test('should not allow a request exceeding the per-second limit', async () => {
    const client = new Client();
    client.clientId = 'client3';
    client.limitPerSecond = 2;
    client.limitPerMonth = 100;

    for (let i = 0; i < 2; i++) {
      await rateLimiter.isRequestAllowed(client, Date.now());
    }

    const result = await rateLimiter.isRequestAllowed(client, Date.now());

    expect(result.allowed).toBe(false);
    expect(result.limitType).toBe('second');
    expect(result.retryAfter).toBeDefined();
  });

  test('should not allow a request exceeding the per-month limit', async () => {
    const client = new Client();
    client.clientId = 'client4';
    client.limitPerSecond = 5;
    client.limitPerMonth = 3;

    for (let i = 0; i < 3; i++) {
      await rateLimiter.isRequestAllowed(client, Date.now());
    }

    const result = await rateLimiter.isRequestAllowed(client, Date.now());

    expect(result.allowed).toBe(false);
    expect(result.limitType).toBe('month');
    expect(result.retryAfter).toBeDefined();
  });
});
