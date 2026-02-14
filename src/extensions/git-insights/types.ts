// Re-export from bindings once available, or define locally for development
export type TimeRange = 7 | 30 | 90;

// These types match the Rust structs in insights.rs (camelCase via serde)
export interface DailyCommitCount {
  date: string;    // "YYYY-MM-DD"
  count: number;
}

export interface ContributorStats {
  name: string;
  email: string;
  commitCount: number;
  percentage: number;
  firstCommitMs: number;
  lastCommitMs: number;
}

export interface RepoInsights {
  totalCommits: number;
  activeBranches: number;
  contributorCount: number;
  firstCommitMs: number;
  dailyCommits: DailyCommitCount[];
  contributors: ContributorStats[];
}

export interface BranchHealthInfo {
  name: string;
  isHead: boolean;
  isRemote: boolean;
  lastCommitDate: string;       // "YYYY-MM-DD"
  lastCommitTimestampMs: number;
  lastCommitMessage: string;
  ahead: number;
  behind: number;
  isStale: boolean;
  isMerged: boolean | null;
}
