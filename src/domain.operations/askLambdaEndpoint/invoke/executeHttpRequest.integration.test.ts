import { MalfunctionError } from 'helpful-errors';
import { getError, given, then, useBeforeAll, when } from 'test-fns';

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { executeHttpRequest } from './executeHttpRequest';

/**
 * .what = opens a real local http server that echoes the request's method, header, and body
 * .why = a communicator is proven against a real boundary, never a mock
 *        (`rule.forbid.integration.mocks`)
 */
const genEchoServer = async (): Promise<{
  url: string;
  close: () => Promise<void>;
}> => {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          method: req.method,
          exid: req.headers['x-trail-exid'] ?? null,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
  });
  await new Promise<void>((onListen) =>
    server.listen(0, '127.0.0.1', onListen),
  );
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((onClose, onFail) =>
        server.close((error) => (error ? onFail(error) : onClose())),
      ),
  };
};

describe('executeHttpRequest', () => {
  given('[case1] a server that answers', () => {
    const echo = useBeforeAll(async () => genEchoServer());
    afterAll(async () => echo.close());

    when('[t0] a request is sent', () => {
      then(
        'the live response comes back with the method, header, and body sent',
        async () => {
          const response = await executeHttpRequest({
            url: echo.url,
            method: 'POST',
            headers: { 'x-trail-exid': 'exid:ord-7' },
            body: 'hello',
            exid: 'exid:ord-7',
          });
          expect(response.status).toEqual(200);
          expect(JSON.parse(await response.text())).toEqual({
            method: 'POST',
            exid: 'exid:ord-7',
            body: 'hello',
          });
        },
      );
    });
  });

  given('[case2] a server that has closed', () => {
    when('[t0] a request is sent', () => {
      then(
        'it throws a MalfunctionError that names the url, method, and exid',
        async () => {
          const echo = await genEchoServer();
          await echo.close();

          const error = await getError(
            executeHttpRequest({
              url: echo.url,
              method: 'GET',
              headers: {},
              body: undefined,
              exid: 'exid:ord-7',
            }),
          );

          expect(error).toBeInstanceOf(MalfunctionError);
          const metadata =
            error instanceof MalfunctionError ? error.metadata : null;
          expect(metadata).toMatchObject({
            url: echo.url,
            method: 'GET',
            exid: 'exid:ord-7',
          });
          expect(metadata?.causeMessage).toContain('fetch failed');
        },
      );
    });
  });
});
