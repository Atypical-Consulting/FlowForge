import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "../../../stores/domain/ui-state";
import {
  createFileChange,
  createStagingStatus,
} from "../../../test-utils/mocks/tauri-commands";
import { fireEvent, render, screen, waitFor } from "../../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getStagingStatus: vi.fn(),
  stageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  stageFiles: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageFiles: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  stageAll: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageAll: vi.fn().mockResolvedValue({ status: "ok", data: null }),
}));

vi.mock("../../../../bindings", () => ({
  commands: mockCommands,
}));

import { StagingPanel } from "./StagingPanel";

const stagedFile = createFileChange({ path: "src/staged.ts", status: "added" });
const modifiedFile = createFileChange({
  path: "src/index.ts",
  status: "modified",
});
const deletedFile = createFileChange({
  path: "src/removed.ts",
  status: "deleted",
});
const renamedFile = createFileChange({
  path: "src/new-name.ts",
  status: { renamed: { old_path: "src/old-name.ts" } },
});
const untrackedFile = createFileChange({
  path: "src/untracked.ts",
  status: "untracked",
});

const status = createStagingStatus({
  staged: [stagedFile],
  unstaged: [modifiedFile, deletedFile, renamedFile],
  untracked: [untrackedFile],
});

describe.each(["tree", "flat"] as const)(
  "StagingPanel section actions (%s view)",
  (viewMode) => {
    beforeEach(() => {
      vi.clearAllMocks();
      // jsdom does not implement scrollIntoView (used by FileItem auto-scroll)
      Element.prototype.scrollIntoView = vi.fn();
      mockCommands.getStagingStatus.mockResolvedValue({
        status: "ok",
        data: status,
      });
      useUIStore.setState({
        stagingViewMode: viewMode,
        stagingSelectedFile: null,
        stagingSelectedSection: null,
      });
    });

    it("Changes → Stage All stages only tracked changes, never untracked files", async () => {
      render(<StagingPanel />);

      fireEvent.click(await screen.findByTitle("Stage all changed files"));

      await waitFor(() => expect(mockCommands.stageFiles).toHaveBeenCalled());
      expect(mockCommands.stageFiles).toHaveBeenCalledTimes(1);
      const paths = mockCommands.stageFiles.mock.calls[0][0] as string[];
      expect(paths).toEqual([
        "src/index.ts",
        "src/removed.ts",
        "src/new-name.ts",
        "src/old-name.ts",
      ]);
      expect(paths).not.toContain("src/untracked.ts");
      expect(paths).not.toContain("src/staged.ts");
      expect(mockCommands.stageAll).not.toHaveBeenCalled();
    });

    it("Untracked Files → Stage All stages only untracked files", async () => {
      render(<StagingPanel />);

      fireEvent.click(await screen.findByTitle("Stage all untracked files"));

      await waitFor(() => expect(mockCommands.stageFiles).toHaveBeenCalled());
      expect(mockCommands.stageFiles).toHaveBeenCalledTimes(1);
      expect(mockCommands.stageFiles).toHaveBeenCalledWith([
        "src/untracked.ts",
      ]);
      expect(mockCommands.stageAll).not.toHaveBeenCalled();
    });

    it("Staged Changes → Unstage All unstages only staged files", async () => {
      render(<StagingPanel />);

      fireEvent.click(await screen.findByTitle("Unstage all staged files"));

      await waitFor(() => expect(mockCommands.unstageFiles).toHaveBeenCalled());
      expect(mockCommands.unstageFiles).toHaveBeenCalledTimes(1);
      expect(mockCommands.unstageFiles).toHaveBeenCalledWith(["src/staged.ts"]);
      expect(mockCommands.unstageAll).not.toHaveBeenCalled();
      expect(mockCommands.stageFiles).not.toHaveBeenCalled();
    });
  },
);
