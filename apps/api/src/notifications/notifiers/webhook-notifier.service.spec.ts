import { WebhookNotifier } from './webhook-notifier.service.js';

describe('WebhookNotifier', () => {
  let notifier: WebhookNotifier;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notifier = new WebhookNotifier();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs a JSON payload compatible with both Slack (text) and Discord (content)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const checkedAt = new Date('2026-01-01T00:00:00Z');

    await notifier.send(
      {
        monitorName: 'example',
        monitorUrl: 'https://example.com',
        statusCode: 500,
        error: 'HTTP 500',
        checkedAt,
      },
      'https://hooks.example.com/webhook',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('example');
    expect(body.content).toBe(body.text);
    expect(body.statusCode).toBe(500);
  });

  it('throws when the webhook endpoint responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    await expect(
      notifier.send(
        { monitorName: 'example', monitorUrl: 'https://example.com', checkedAt: new Date() },
        'https://hooks.example.com/webhook',
      ),
    ).rejects.toThrow('404');
  });
});
