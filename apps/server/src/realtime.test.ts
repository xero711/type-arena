import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { io as createClient } from 'socket.io-client';
import { afterAll, describe, expect, it } from 'vitest';
import { attachRealtime, parseWebOrigins } from './realtime.js';

describe('Socket.IO origin configuration', () => {
  it('treats comma-separated web origins as separate allowed origins', () => {
    expect(parseWebOrigins('http://localhost:5173, https://xero-x.me')).toEqual([
      'http://localhost:5173',
      'https://xero-x.me',
    ]);
  });
});

describe('Socket.IO authentication', () => {
  const httpServer = createServer();
  const ioServer = attachRealtime(httpServer);

  afterAll(async () => {
    await ioServer.shutdownGracefully();
  });

  it('rejects sockets that do not provide a Firebase bearer token', async () => {
    httpServer.listen(0, '127.0.0.1');
    await once(httpServer, 'listening');
    const { port } = httpServer.address() as AddressInfo;
    const client = createClient(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false, timeout: 3000 });
    const error = await new Promise<Error>((resolve) => client.once('connect_error', resolve));
    expect(error.message).toBe('missing-token');
    client.close();
  });
});
