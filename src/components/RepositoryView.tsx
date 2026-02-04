import { Folder, GitBranch } from "lucide-react";
import { useRepositoryStore } from "../stores/repository";

export function RepositoryView() {
  const { status } = useRepositoryStore();

  if (!status) return null;

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex p-4 rounded-full bg-gray-800/50">
          <Folder className="w-12 h-12 text-green-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">{status.repoName}</h2>
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <GitBranch className="w-4 h-4" />
          <span>{status.branchName}</span>
          {status.isDirty && (
            <span className="text-yellow-500 text-sm">(modified)</span>
          )}
        </div>
        <p className="text-sm text-gray-500 break-all">{status.repoPath}</p>
        <p className="text-sm text-gray-600 mt-8">
          Staging, commits, and branch operations coming in Phase 2
        </p>
      </div>
    </div>
  );
}
