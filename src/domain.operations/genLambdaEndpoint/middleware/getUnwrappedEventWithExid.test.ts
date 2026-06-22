import { getUnwrappedEventWithExid } from './getUnwrappedEventWithExid';

describe('getUnwrappedEventWithExid', () => {
  it('should extract exid and event from wrapped payload', () => {
    const result = getUnwrappedEventWithExid({
      payload: {
        event: { message: 'hello' },
        trail: { exid: 'exid:abc-123' },
      },
    });

    expect(result).toEqual({
      exidFromPayload: 'exid:abc-123',
      unwrappedEvent: { message: 'hello' },
      isContempCaller: true,
    });
  });

  it('should return null exid when wrapped payload has no exid', () => {
    const result = getUnwrappedEventWithExid({
      payload: {
        event: { message: 'hello' },
        trail: {},
      },
    });

    expect(result).toEqual({
      exidFromPayload: null,
      unwrappedEvent: { message: 'hello' },
      isContempCaller: true,
    });
  });

  it('should return raw payload as event when not wrapped', () => {
    const result = getUnwrappedEventWithExid({
      payload: { message: 'hello' },
    });

    expect(result).toEqual({
      exidFromPayload: null,
      unwrappedEvent: { message: 'hello' },
      isContempCaller: false,
    });
  });

  it('should handle primitive payloads', () => {
    const result = getUnwrappedEventWithExid({
      payload: 'just a string',
    });

    expect(result).toEqual({
      exidFromPayload: null,
      unwrappedEvent: 'just a string',
      isContempCaller: false,
    });
  });
});
