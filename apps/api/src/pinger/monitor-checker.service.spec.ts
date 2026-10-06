import { MonitorCheckerService } from './monitor-checker.service.js';

describe('MonitorCheckerService', () => {
  let service: MonitorCheckerService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new MonitorCheckerService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports UP for a 2xx response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await service.check('https://example.com', 1000);

    expect(result.status).toBe('UP');
    expect(result.statusCode).toBe(200);
    expect(result.error).toBeUndefined();
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('reports UP for a 3xx redirect response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 301 }));

    const result = await service.check('https://example.com', 1000);

    expect(result.status).toBe('UP');
    expect(result.statusCode).toBe(301);
  });

  it('reports DOWN for a 4xx/5xx response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const result = await service.check('https://example.com', 1000);

    expect(result.status).toBe('DOWN');
    expect(result.statusCode).toBe(503);
    expect(result.error).toBe('HTTP 503');
  });

  it('reports DOWN with no status code on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await service.check('https://unreachable.invalid', 1000);

    expect(result.status).toBe('DOWN');
    expect(result.statusCode).toBeUndefined();
    expect(result.error).toBe('fetch failed');
  });

  it('reports a timeout as DOWN when the request exceeds timeoutMs', async () => {
    fetchMock.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const result = await service.check('https://slow.invalid', 20);

    expect(result.status).toBe('DOWN');
    expect(result.error).toBe('Timed out after 20ms');
  });
});
