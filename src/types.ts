export interface DiffLine {
  type: "context" | "added" | "removed";
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
}

export interface PRFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions?: number;
  deletions?: number;
  diff: DiffLine[];
  explanation: string;
  /** Full new file content — alternative to diff. Server computes diff from this. */
  content?: string;
  /** Original file content — used with content for modified/deleted files. */
  oldContent?: string;
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
  prs: PRData[];
  reviews: Record<string, ReviewEntry>;
}

export interface QuinnData {
  settings: { firstTimeSeen: boolean };
  projects: Project[];
}
