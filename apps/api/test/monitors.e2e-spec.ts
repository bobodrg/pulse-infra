import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Monitors (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;

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
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a valid X-User-Id header', () => {
    return request(app.getHttpServer()).get('/monitors').expect(401);
  });

  it('rejects an invalid create payload', () => {
    return request(app.getHttpServer())
      .post('/monitors')
      .set('X-User-Id', userId)
      .send({ name: '', url: 'not-a-url' })
      .expect(400);
  });

  it('creates, lists, updates, and deletes a monitor scoped to the caller', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-User-Id', userId)
      .send({ name: 'Example', url: 'https://example.com' })
      .expect(201);

    expect(createRes.body).toMatchObject({
      name: 'Example',
      url: 'https://example.com',
      intervalSeconds: 60,
      isActive: true,
    });
    const monitorId = createRes.body.id as string;

    await request(app.getHttpServer())
      .get('/monitors')
      .set('X-User-Id', userId)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .patch(`/monitors/${monitorId}`)
      .set('X-User-Id', userId)
      .send({ intervalSeconds: 120 })
      .expect(200)
      .expect((res) => {
        expect(res.body.intervalSeconds).toBe(120);
      });

    await request(app.getHttpServer())
      .delete(`/monitors/${monitorId}`)
      .set('X-User-Id', userId)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/monitors/${monitorId}`)
      .set('X-User-Id', userId)
      .expect(404);
  });

  it("does not let one user read another user's monitor", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-User-Id', userId)
      .send({ name: 'Private', url: 'https://example.com' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/monitors/${createRes.body.id}`)
      .set('X-User-Id', otherUserId)
      .expect(404);
  });
});
