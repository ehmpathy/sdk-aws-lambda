/**
 * .what = test lambda handler for sdk-aws-lambda integration tests
 * .why = enables real invocation tests without mock aws lambda client
 *
 * .note = payload format matches askLambdaEndpoint: { event: TRequest, trail: { exid } }
 */
export const handler = async (payload: {
  event?: { message?: string };
  trail?: { exid?: string };
}): Promise<{
  echo: {
    message: string | null;
    trail: { exid: string | null };
  };
  meta: {
    invokedAt: string;
    functionName: string;
  };
}> => {
  return {
    echo: {
      message: payload.event?.message ?? null,
      trail: { exid: payload.trail?.exid ?? null },
    },
    meta: {
      invokedAt: new Date().toISOString(),
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'unknown',
    },
  };
};
