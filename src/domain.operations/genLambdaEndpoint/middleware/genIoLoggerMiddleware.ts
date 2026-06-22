import type middy from '@middy/core';

export interface IoLogTranslate {
  input?: (event: unknown) => unknown;
  output?: (response: unknown) => unknown;
}

interface LogMethods {
  debug: (message: string, data: Record<string, unknown>) => void;
}

/**
 * .what = middleware that logs handler input and output
 * .why = enables debug observability with optional redaction via logTranslate
 */
export const genIoLoggerMiddleware = (input?: {
  logTranslate?: IoLogTranslate;
}): {
  before: middy.MiddlewareFn<any, any>;
  after: middy.MiddlewareFn<any, any>;
  onError: middy.MiddlewareFn<any, any>;
} => {
  const translateInput = input?.logTranslate?.input ?? ((event) => event);
  const translateOutput =
    input?.logTranslate?.output ?? ((response) => response);

  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const log = (request.context as { log?: LogMethods })?.log;
    if (log) {
      log.debug('handler.input', { event: translateInput(request.event) });
    }
  };

  const after: middy.MiddlewareFn<any, any> = async (request) => {
    const log = (request.context as { log?: LogMethods })?.log;
    if (log) {
      log.debug('handler.output', {
        response: translateOutput(request.response),
      });
    }
  };

  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    const log = (request.context as { log?: LogMethods })?.log;
    if (log) {
      if (request.response) {
        log.debug('handler.output', {
          response: translateOutput(request.response),
        });
      } else if (request.error) {
        log.debug('handler.output', {
          errorMessage: request.error.message,
          stackTrace: request.error.stack,
        });
      }
    }
  };

  return { before, after, onError };
};
