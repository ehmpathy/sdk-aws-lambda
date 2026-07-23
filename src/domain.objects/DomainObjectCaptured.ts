import { DomainLiteral, type DomainObjectKind } from 'domain-objects';
import type { JSONSchema } from 'zod/v4/core/json-schema';

/**
 * .what = a domain-object captured from an introspected `x-domain-object` pragma,
 *         normalized for emit (the raw domain-objects `DomainObjectPragma` fields +
 *         the json-schema `shape`, with the key-fields defaulted)
 * .why = parse the wire pragma once at the boundary into a structured value; all
 *        downstream ops speak in this instead of a re-read of the raw json
 *
 * .kind = which base class the upstream dobj extended (from the pragma's stamped
 *         `kind`); governs which base class asResourceClassSource emits
 */
export interface DomainObjectCaptured {
  /**
   * .what = the upstream domain-object's unqualified class name (e.g. 'Job')
   * .why = the codegen prefixes this with the service (e.g. 'SvcJobsJob')
   */
  name: string;

  /**
   * .what = which base class the upstream dobj extended (entity/literal/event/object)
   * .why = the codegen emits the base class this maps to
   */
  kind: DomainObjectKind;

  /**
   * .what = the primary key parts (artificial/serialized key), if any
   */
  primary: string[];

  /**
   * .what = the unique key parts (natural key), if any
   */
  unique: string[];

  /**
   * .what = the colloquial alias, if declared upstream
   */
  alias: null | string | { singular?: string; plural?: string };

  /**
   * .what = map of nested-property name → nested dobj type name(s), unprefixed
   * .why = the codegen prefixes each nested type name with the service; a value
   *        is an array when the nested position is polymorphic (choice of dobjs)
   */
  nested: Record<string, string | string[]>;

  /**
   * .what = the json-schema shape of the dobj (for TS type emit)
   */
  shape: JSONSchema;
}

export class DomainObjectCaptured
  extends DomainLiteral<DomainObjectCaptured>
  implements DomainObjectCaptured {}
