import { DomainLiteral } from 'domain-objects';

/**
 * .what = one file the codegen will emit (path + content)
 * .why = the emit boundary speaks in a named domain literal, not raw tuples;
 *        the batch communicator writes a list of these atomically
 */
export interface GeneratedFile {
  /**
   * .what = the absolute-or-relative path the file will be written to
   */
  path: string;

  /**
   * .what = the full text content of the file (already formatted)
   */
  content: string;
}

export class GeneratedFile
  extends DomainLiteral<GeneratedFile>
  implements GeneratedFile {}
