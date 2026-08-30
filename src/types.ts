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
}

export interface PRData {
  title: string;
  description: string;
  branch: string;
  label?: string;
  files: PRFile[];
  completed?: boolean;
}
