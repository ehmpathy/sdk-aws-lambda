import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useBeforeAll, when } from 'test-fns';

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { askLambdaEndpoint } from './askLambdaEndpoint';

const CONTEXT = genContextLogTrail({
  trail: { exid: 'exid:via-test', stack: [] },
  env: null,
});

/**
 * .what = opens a real local http server that answers per path, and records what it received
 * .why = `viaApiGateway` is a communicator, proven against a real boundary and never a mock
 *        (`rule.forbid.integration.mocks`). each path answers one shape an http endpoint can give:
 *        a flat body, an html page from a proxy, an empty 204, and an echo of the request
 */
const genAnswerServer = async (): Promise<{
  url: string;
  close: () => Promise<void>;
}> => {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (req.url === '/flat-400') {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ errorMessage: 'bad', errorType: 'BadRequestError' }),
        );
        return;
      }
      if (req.url === '/html-502') {
        res.writeHead(502, { 'content-type': 'text/html' });
        res.end('<html><body>bad gateway</body></html>');
        return;
      }
      if (req.url === '/empty-204') {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          method: req.method,
          exid: req.headers['x-trail-exid'] ?? null,
          bodyReceived: Buffer.concat(chunks).toString('utf8'),
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

describe('askLambdaEndpoint.viaApiGateway', () => {
  given('[case1] a server that answers each shape', () => {
    const server = useBeforeAll(async () => genAnswerServer());
    afterAll(async () => server.close());

    when('[t0] the answer is a flat 400 from an old endpoint', () => {
      then(
        'it throws a ConstraintError, with the raw text kept in the metadata',
        async () => {
          const error = await getError(
            askLambdaEndpoint.viaApiGateway(
              { url: `${server.url}/flat-400`, method: 'POST', body: {} },
              CONTEXT,
            ),
          );
          expect(error).toBeInstanceOf(ConstraintError);
          const metadata = (error as ConstraintError).metadata;
          expect(String(metadata?.text)).toContain('BadRequestError');
        },
      );
    });

    when('[t1] the answer is an html 502 from a proxy', () => {
      then(
        'it throws a MalfunctionError, with the page in the metadata',
        async () => {
          const error = await getError(
            askLambdaEndpoint.viaApiGateway(
              { url: `${server.url}/html-502`, method: 'POST', body: {} },
              CONTEXT,
            ),
          );
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(String((error as MalfunctionError).metadata?.text)).toContain(
            'bad gateway',
          );
        },
      );
    });

    when('[t2] the answer is an empty 204', () => {
      then('it resolves with an empty text and a null body', async () => {
        const response = await askLambdaEndpoint.viaApiGateway(
          { url: `${server.url}/empty-204`, method: 'DELETE' },
          CONTEXT,
        );
        expect(response.status).toEqual(204);
        expect(response.text).toEqual('');
        expect(response.body).toBeNull();
      });
    });

    when('[t3] a body is given and no method', () => {
      then('the request is a POST', async () => {
        const response = await askLambdaEndpoint.viaApiGateway<{
          method: string;
          bodyReceived: string;
        }>({ url: `${server.url}/echo`, body: { a: 1 } }, CONTEXT);
        expect(response.body?.method).toEqual('POST');
        expect(JSON.parse(response.body?.bodyReceived ?? '')).toEqual({
          a: 1,
        });
      });
    });

    when('[t4] neither a body nor a method is given', () => {
      then('the request is a GET', async () => {
        const response = await askLambdaEndpoint.viaApiGateway<{
          method: string;
        }>({ url: `${server.url}/echo` }, CONTEXT);
        expect(response.body?.method).toEqual('GET');
      });
    });

    when('[t5] a caller header names the opt-in in another case', () => {
      then('the wire holds the trail exid alone', async () => {
        const response = await askLambdaEndpoint.viaApiGateway<{
          exid: string;
        }>(
          {
            url: `${server.url}/echo`,
            headers: { 'X-Trail-Exid': 'exid:imposter' },
          },
          CONTEXT,
        );
        // a joined `exid:imposter, exid:via-test` would mean both variants crossed
        expect(response.body?.exid).toEqual('exid:via-test');
      });
    });
  });
});
