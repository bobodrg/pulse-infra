import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Checks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;
  let monitorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    userId = randomUUID();
    otherUserId = randomUUID();
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, passwordHash: 'test' },
    });
    await prisma.user.create({
      data: { id: otherUserId, email: `${otherUserId}@example.com`, passwordHash: 'test' },
    });

    const monitor = await prisma.monitor.create({
      data: { userId, name: 'Example', url: 'https://example.com' },
    });
    monitorId = monitor.id;

    // Seeded directly since the background pinger (Step 3c) doesn't exist yet.
    // checkedAt is set explicitly and spread apart: CURRENT_TIMESTAMP is
    // evaluated once per statement in Postgres, so a single createMany call
    // would give every row the same default timestamp and make ordering
    // among them undefined.
    const now = Date.now();
    await prisma.check.createMany({
      data: [
        {
          monitorId,
          status: 'UP',
          statusCode: 200,
          responseTimeMs: 120,
          checkedAt: new Date(now - 2000),
        },
        {
          monitorId,
          status: 'DOWN',
          statusCode: 500,
          error: 'Internal Server Error',
          checkedAt: new Date(now - 1000),
        },
        { monitorId, status: 'UP', statusCode: 200, responseTimeMs: 98, checkedAt: new Date(now) },
      ],
    });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a valid X-User-Id header', () => {
    return request(app.getHttpServer()).get(`/monitors/${monitorId}/checks`).expect(401);
  });

  it("returns 404 for a monitor the caller doesn't own", () => {
    return request(app.getHttpServer())
      .get(`/monitors/${monitorId}/checks`)
      .set('X-User-Id', otherUserId)
      .expect(404);
  });

  it('lists checks newest first with pagination metadata', async () => {
    const res = await request(app.getHttpServer())
      .get(`/monitors/${monitorId}/checks`)
      .set('X-User-Id', userId)
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(50);
    expect(res.body.offset).toBe(0);
    expect(res.body.items).toHaveLength(3);
    // Most recently created check (the second UP) should come first.
    expect(res.body.items[0].status).toBe('UP');
    expect(res.body.items[0].responseTimeMs).toBe(98);
  });

  it('respects limit and offset query params', async () => {
    const res = await request(app.getHttpServer())
      .get(`/monitors/${monitorId}/checks?limit=1&offset=1`)
      .set('X-User-Id', userId)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.offset).toBe(1);
    expect(res.body.total).toBe(3);
  });

  it('rejects an out-of-range limit', () => {
    return request(app.getHttpServer())
      .get(`/monitors/${monitorId}/checks?limit=500`)
      .set('X-User-Id', userId)
      .expect(400);
  });
});
