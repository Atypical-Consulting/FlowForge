import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { NavigationProvider } from "@/framework/layout/navigation/context";
import { useUIStore } from "../../stores/domain/ui-state";
import {
  createFileChange,
  createStagingStatus,
  ok,
} from "../../test-utils/mocks/tauri-commands";
import {
  act,
  render,
  render as rtlRender,
  screen,
  within,
} from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getStagingStatus: vi.fn().mockResolvedValue({
    status: "ok",
    data: { staged: [], unstaged: [], untracked: [] },
  }),
  getFileDiff: vi.fn().mockResolvedValue({
    status: "ok",
    data: {
      path: "",
      oldContent: "",
      newContent: "",
      hunks: [],
      isBinary: false,
      language: "text",
    },
  }),
  stageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  stageAll: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageAll: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  suggestCommitType: vi.fn().mockResolvedValue({
    status: "ok",
    data: { suggestedType: "feat", confidence: "medium", reason: "" },
  }),
  getScopeSuggestions: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  inferScopeFromStaged: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  createCommit: vi.fn().mockResolvedValue({
    status: "ok",
    data: { oid: "abc", shortOid: "abc", message: "" },
  }),
  validateConventionalCommit: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    warnings: [],
  }),
  getLastCommitMessage: vi.fn().mockResolvedValue({
    status: "ok",
    data: { subject: "", body: null, fullMessage: "" },
  }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: () => <div data-testid="mock-diff-editor" />,
  default: () => <div data-testid="mock-editor" />,
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({ editor: { defineTheme: vi.fn() } }),
  },
}));

import { StagingChangesBlade } from "./StagingChangesBlade";

describe("StagingChangesBlade", () => {
  beforeAll(() => {
    // jsdom does not implement scrollIntoView (used by FileItem on selection)
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders without crashing", () => {
    const { container } = render(<StagingChangesBlade />);
    expect(container.firstChild).not.toBeNull();
  });

  it("clears the diff pane when the selected file disappears from the status", async () => {
    // Own QueryClient so the test can force a status refetch, exactly like
    // the commit flow (and stash/discard/branch switch) does via invalidation.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>
          <MotionConfig reducedMotion="always">{children}</MotionConfig>
        </NavigationProvider>
      </QueryClientProvider>
    );

    const file = createFileChange({ path: "src/index.ts" });
    mockCommands.getStagingStatus.mockResolvedValue(
      ok(createStagingStatus({ unstaged: [file] })),
    );

    rtlRender(<StagingChangesBlade />, { wrapper });

    // The file is auto-selected and its diff header shows in the diff pane.
    const diffPane = screen.getByRole("region", { name: "Diff preview" });
    expect(await within(diffPane).findByText("index.ts")).toBeInTheDocument();
    expect(useUIStore.getState().stagingSelectedFile?.path).toBe(
      "src/index.ts",
    );

    // The file gets committed: the fresh status no longer contains it.
    mockCommands.getStagingStatus.mockResolvedValue(ok(createStagingStatus()));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    });

    expect(await screen.findByText("All clear!")).toBeInTheDocument();
    expect(
      await within(diffPane).findByText("Select a file to preview diff"),
    ).toBeInTheDocument();
    expect(within(diffPane).queryByText("index.ts")).not.toBeInTheDocument();
    expect(useUIStore.getState().stagingSelectedFile).toBeNull();
    expect(useUIStore.getState().stagingSelectedSection).toBeNull();
  });
});
