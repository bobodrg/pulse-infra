import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { createServer, Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PingerService } from '../src/pinger/pinger.service.js';

describe('PingerService (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pinger: PingerService;
  let userId: string;
  let server: Server;
  let serverUrl: string;
  let respondWith: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void;
  let webhookServer: Server;
  let webhookServerUrl: string;
  let receivedWebhooks: unknown[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    pinger = app.get(PingerService);

    // onModuleInit() already registered a real setInterval ticking on its
    // own schedule; this test drives PingerService.tick() manually and
    // deterministically, so stop the automatic one to avoid cross-test
    // interference if a background tick fires mid-assertion.
    app.get(SchedulerRegistry).deleteInterval('pinger-tick');

    server = createServer((req, res) => respondWith(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${port}`;

    webhookServer = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        receivedWebhooks.push(JSON.parse(Buffer.concat(chunks).toString()));
        res.writeHead(200).end();
      });
    });
    await new Promise<void>((resolve) => webhookServer.listen(0, '127.0.0.1', resolve));
    const webhookPort = (webhookServer.address() as AddressInfo).port;
    webhookServerUrl = `http://127.0.0.1:${webhookPort}`;
  });

  beforeEach(async () => {
    userId = randomUUID();
    receivedWebhooks = [];
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, passwordHash: 'test' },
    });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => webhookServer.close(resolve));
    await app.close();
  });

  it('records an UP check for a monitor whose target responds 200', async () => {
    respondWith = (_req, res) => res.writeHead(200).end('ok');

    const monitor = await prisma.monitor.create({
      data: { userId, name: 'target', url: serverUrl, intervalSeconds: 60 },
    });

    await pinger.tick();

    const checks = await prisma.check.findMany({ where: { monitorId: monitor.id } });
    expect(checks).toHaveLength(1);
    expect(checks[0].status).toBe('UP');
    expect(checks[0].statusCode).toBe(200);

    const updated = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });
    expect(updated.lastCheckedAt).not.toBeNull();
  });

  it('records a DOWN check for a monitor whose target responds 500', async () => {
    respondWith = (_req, res) => res.writeHead(500).end('error');

    const monitor = await prisma.monitor.create({
      data: { userId, name: 'target', url: serverUrl, intervalSeconds: 60 },
    });

    await pinger.tick();

    const checks = await prisma.check.findMany({ where: { monitorId: monitor.id } });
    expect(checks).toHaveLength(1);
    expect(checks[0].status).toBe('DOWN');
    expect(checks[0].statusCode).toBe(500);
  });

  it('does not re-check a monitor before its interval has elapsed', async () => {
    respondWith = (_req, res) => res.writeHead(200).end('ok');

    const monitor = await prisma.monitor.create({
      data: { userId, name: 'target', url: serverUrl, intervalSeconds: 3600 },
    });

    await pinger.tick();
    await pinger.tick();

    const checks = await prisma.check.findMany({ where: { monitorId: monitor.id } });
    expect(checks).toHaveLength(1);
  });

  it('does not check an inactive monitor', async () => {
    respondWith = (_req, res) => res.writeHead(200).end('ok');

    const monitor = await prisma.monitor.create({
      data: { userId, name: 'target', url: serverUrl, intervalSeconds: 60, isActive: false },
    });

    await pinger.tick();

    const checks = await prisma.check.findMany({ where: { monitorId: monitor.id } });
    expect(checks).toHaveLength(0);
  });

  it('fires a webhook alert only on the UP -> DOWN transition, not on every subsequent failure', async () => {
    const monitor = await prisma.monitor.create({
      data: {
        userId,
        name: 'target',
        url: serverUrl,
        intervalSeconds: 0,
        notifyEmail: false,
        notifyWebhookUrl: webhookServerUrl,
      },
    });

    respondWith = (_req, res) => res.writeHead(200).end('ok');
    await pinger.tick();
    expect(receivedWebhooks).toHaveLength(0);

    respondWith = (_req, res) => res.writeHead(500).end('error');
    await pinger.tick();
    expect(receivedWebhooks).toHaveLength(1);
    expect(receivedWebhooks[0]).toMatchObject({ monitorName: 'target', statusCode: 500 });

    await pinger.tick();
    expect(receivedWebhooks).toHaveLength(1);

    respondWith = (_req, res) => res.writeHead(200).end('ok');
    await pinger.tick();
    respondWith = (_req, res) => res.writeHead(500).end('error');
    await pinger.tick();
    expect(receivedWebhooks).toHaveLength(2);

    await prisma.monitor.delete({ where: { id: monitor.id } });
  });
});
