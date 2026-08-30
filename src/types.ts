export interface DiffLine {
  type: "context" | "added" | "removed";
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
}

export interface PRFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff: DiffLine[];
  explanation: string;
  /** Full new file content. Server computes diff from this. Required for added/modified. */
  content?: string;
  /** Search/replace edits. Alternative to content for modified files. Server reads old content from disk and applies each edit. */
  edits?: Array<{ search: string; replace: string }>;
}

export interface PRData {
  title: string;
  description: string;
  branch: string;
  label?: string;
  files: PRFile[];
  completed?: boolean;
}

export interface ReviewEntry {
  verdict: string;
  comment: string | null;
}

export interface Project {
  id: string;
  name: string;
  theme: string;
  /** Filesystem root path for reading existing files to compute diffs. */
  path?: string;
  prs: PRData[];
  reviews: Record<string, ReviewEntry>;
}

export interface QuinnData {
  settings: { firstTimeSeen: boolean };
  projects: Project[];
}
