import type { S3Event, S3EventRecord } from 'aws-lambda';

import { AWS_REGION_SYNTHETIC } from '../../domain.objects/AwsIdentitySynthetic';
import { AWS_EVENT_AT_ISO } from './asLambdaEvent.constants';

/**
 * .what = casts object references into the s3 envelope aws delivers
 * .why = an s3 consumer receives `{ Records: [{ s3: { bucket, object } }] }`
 *
 * 🔴 **s3 carries NO payload — only a reference.** the handler is told an object
 *    changed, and must fetch it. so this factory takes bucket + key, never a body.
 *    that asymmetry is the source axis at work: `s3` is the one value of D6 where
 *    the payload is absent by nature (define.lambda-event-source).
 *
 * wire-faithful by default, per F10 — see `asLambdaEvent.fromSqs` for the argument.
 *
 * @example
 * ```ts
 * const event = asLambdaEvent.fromS3({ objects: [{ bucket: 'photos', key: 'a.jpg' }] });
 * ```
 */
export const fromS3 = (input: {
  /**
   * the objects that changed — a reference each, never a body
   */
  objects: { bucket: string; key: string; size?: number }[];

  /**
   * the event name. an object-create by default.
   *
   * both spellings are taken — `ObjectCreated:Put` and `s3:ObjectCreated:Put`.
   * aws documents the notification TYPE with the `s3:` prefix and delivers the
   * event NAME without it, so an author who copies the documented string is
   * right and their fixture would otherwise be wrong.
   */
  eventName?: string;

  /**
   * per-record overrides, applied to every record
   */
  record?: Partial<S3EventRecord>;
}): S3Event => {
  // 🔴 the prefix is stripped, never trusted. aws's own docs name the type
  //    `s3:ObjectCreated:Put` while the wire delivers `ObjectCreated:Put`, so a
  //    pass-through would hand back an event no real bucket ever sends — and it
  //    would type-check, which makes it the silent wrong-value this factory
  //    exists to prevent (F10).
  //
  //    ✅ the incumbent strips it too (`createExampleS3Event.ts:46`), so this is
  //      parity rather than a new opinion — and that parity is the note worth
  //      keeping: a successor that "simplifies" the strip away reintroduces the
  //      exact defect, and no type check refuses it.
  const eventName = (input.eventName ?? 'ObjectCreated:Put').replace(
    /^s3:/,
    '',
  );

  return {
    Records: input.objects.map((object, index) => ({
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: AWS_REGION_SYNTHETIC,
      // ⚠️ the ISO representation, shared with sns and derived from the one
      //    constant — never hand-written here. the three factories say the same
      //    instant three ways (iso · millis · seconds), so a hand-edit to any
      //    one of them drifts it out of agreement with the other two.
      eventTime: AWS_EVENT_AT_ISO,
      eventName,
      userIdentity: { principalId: 'EXAMPLE' },
      requestParameters: { sourceIPAddress: '127.0.0.1' },
      responseElements: {
        'x-amz-request-id': `EXAMPLE${index}`,
        'x-amz-id-2': `EXAMPLE${index}`,
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'example-config',
        bucket: {
          name: object.bucket,
          ownerIdentity: { principalId: 'EXAMPLE' },
          arn: `arn:aws:s3:::${object.bucket}`,
        },
        object: {
          key: object.key,
          size: object.size ?? 1024,
          eTag: '00000000000000000000000000000000',
          sequencer: `00${String(index).padStart(20, '0')}`,
        },
      },
      ...input.record,
    })),
  };
};
