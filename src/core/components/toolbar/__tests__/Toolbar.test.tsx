import { FolderOpen, X } from "lucide-react";
import { useToolbarRegistry } from "@/framework/extension-system/toolbarRegistry";
import {
  isRepositoryOpen,
  useGitOpsStore,
} from "../../../stores/domain/git-ops";
import { act, createRepoStatus, render, screen } from "../../../test-utils";
import { Toolbar } from "../Toolbar";

const SOURCE = "test:toolbar";

function registerActions() {
  useToolbarRegistry.getState().registerMany([
    {
      id: "test:open-repo",
      label: "Open Repository",
      icon: FolderOpen,
      group: "app",
      priority: 100,
      source: SOURCE,
      execute: () => {},
    },
    {
      id: "test:close-repo",
      label: "Close Repository",
      icon: X,
      group: "navigation",
      priority: 60,
      source: SOURCE,
      when: isRepositoryOpen,
      execute: () => {},
    },
  ]);
}

function openRepository() {
  act(() => {
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ repoPath: "/repo", repoName: "repo" }),
    });
  });
}

function closeRepository() {
  act(() => {
    useGitOpsStore.setState({ repoStatus: null });
  });
}

describe("Toolbar repository actions", () => {
  beforeEach(() => {
    registerActions();
  });

  afterEach(() => {
    useToolbarRegistry.getState().unregisterBySource(SOURCE);
  });

  it("hides repository actions while the repo store has no repoStatus (welcome screen)", () => {
    render(<Toolbar />);

    expect(
      screen.getByRole("button", { name: "Open Repository" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close Repository" }),
    ).not.toBeInTheDocument();
  });

  it("shows repository actions once a repository is open, and hides them again on close", () => {
    render(<Toolbar />);

    openRepository();
    expect(
      screen.getByRole("button", { name: "Close Repository" }),
    ).toBeInTheDocument();

    closeRepository();
    expect(
      screen.queryByRole("button", { name: "Close Repository" }),
    ).not.toBeInTheDocument();
  });

  it("re-evaluates when() for actions registered after mount", () => {
    render(<Toolbar />);
    openRepository();

    act(() => {
      useToolbarRegistry.getState().register({
        id: "test:late",
        label: "Late Action",
        icon: X,
        group: "views",
        priority: 10,
        source: SOURCE,
        when: isRepositoryOpen,
        execute: () => {},
      });
    });

    expect(
      screen.getByRole("button", { name: "Late Action" }),
    ).toBeInTheDocument();
  });
});
