export type DiffOpType = 'eq' | 'del' | 'add' | 'mod';

export interface DiffOp {
  type: DiffOpType;
  a?: string;
  b?: string;
  ai?: number;
  bi?: number;
}

export interface Hunk {
  ops: DiffOp[];
  aStart: number;
  bStart: number;
  aCount: number;
  bCount: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  similarity: number;
  hunks: number;
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  wordDiff: boolean;
}
