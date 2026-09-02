import { GitBranch, Layers, Upload } from "lucide-react";
import {
  type ToolbarAction,
  useToolbarRegistry,
} from "@/framework/extension-system/toolbarRegistry";
import { useGitOpsStore } from "../../../stores/domain/git-ops";
import { act, createRepoStatus, render, screen } from "../../../test-utils";
import { Toolbar } from "../Toolbar";

/** Core action with no `when()` -- always visible, like Staging. */
const staging: ToolbarAction = {
  id: "tb:staging",
  label: "Staging",
  icon: Layers,
  group: "app",
  priority: 10,
  execute: () => {},
};

/** Extension action gated on an open repository, like Push. */
const push: ToolbarAction = {
  id: "ext:sync:push",
  label: "Push",
  icon: Upload,
  group: "git-actions",
  priority: 90,
  source: "ext:sync",
  when: () => !!useGitOpsStore.getState().repoStatus,
  execute: () => {},
};

const createBranch: ToolbarAction = {
  id: "ext:branches:create-branch",
  label: "Create Branch",
  icon: GitBranch,
  group: "git-actions",
  priority: 80,
  source: "ext:branches",
  when: () => !!useGitOpsStore.getState().repoStatus,
  execute: () => {},
};

function openRepository() {
  act(() => {
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ branchName: "develop" }),
    });
  });
}

function closeRepository() {
  act(() => {
    useGitOpsStore.setState({ repoStatus: null });
  });
}

const button = (label: string) => screen.queryByRole("button", { name: label });

describe("Toolbar visibility", () => {
  it("shows actions whose when() becomes true after the repository opens, without remounting", () => {
    useToolbarRegistry.getState().registerMany([staging, push, createBranch]);
    render(<Toolbar />);

    // Welcome screen: only the ungated core action.
    expect(button("Staging")).toBeInTheDocument();
    expect(button("Push")).not.toBeInTheDocument();
    expect(button("Create Branch")).not.toBeInTheDocument();

    openRepository();

    expect(button("Staging")).toBeInTheDocument();
    expect(button("Push")).toBeInTheDocument();
    expect(button("Create Branch")).toBeInTheDocument();

    closeRepository();

    expect(button("Push")).not.toBeInTheDocument();
    expect(button("Create Branch")).not.toBeInTheDocument();
  });

  it("reflects an action registered after the toolbar mounted", () => {
    useToolbarRegistry.getState().register(staging);
    render(<Toolbar />);
    expect(button("Staging")).toBeInTheDocument();

    const late: ToolbarAction = {
      id: "ext:demo:late",
      label: "Late Action",
      icon: Layers,
      group: "views",
      priority: 1,
      source: "ext:demo",
      execute: () => {},
    };
    act(() => useToolbarRegistry.getState().register(late));
    expect(button("Late Action")).toBeInTheDocument();

    act(() => useToolbarRegistry.getState().unregisterBySource("ext:demo"));
    expect(button("Late Action")).not.toBeInTheDocument();
  });

  it("re-evaluates when() on refreshVisibility() for conditions outside the repo store", () => {
    let authenticated = false;
    const gated: ToolbarAction = {
      id: "ext:github:prs",
      label: "Pull Requests",
      icon: GitBranch,
      group: "git-actions",
      priority: 1,
      source: "ext:github",
      when: () => authenticated,
      execute: () => {},
    };
    useToolbarRegistry.getState().registerMany([staging, gated]);
    render(<Toolbar />);
    expect(button("Pull Requests")).not.toBeInTheDocument();

    authenticated = true;
    act(() => useToolbarRegistry.getState().refreshVisibility());
    expect(button("Pull Requests")).toBeInTheDocument();
  });
});
