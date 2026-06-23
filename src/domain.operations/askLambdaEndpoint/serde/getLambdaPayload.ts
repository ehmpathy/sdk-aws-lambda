/**
 * .what = transforms event and trail context into lambda payload
 * .why = lambda invocations need trail context for distributed trace
 */
export const getLambdaPayload = <TEvent>(input: {
  event: TEvent;
  trail: { exid: string };
}): { event: TEvent; trail: { exid: string } } => {
  return {
    event: input.event,
    trail: { exid: input.trail.exid },
  };
};
