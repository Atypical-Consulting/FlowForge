// Registers the core workflows (staging/topology) with the navigation machine.
import "../../../core/workflows";
import {
  registerBlade,
  useBladeRegistry,
} from "@/framework/layout/bladeRegistry";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import {
  selectActiveWorkflow,
  selectBladeStack,
} from "@/framework/layout/navigation/selectors";
import { showTopologyView } from "../../../core/lib/topologyNavigation";
import { useUIStore } from "../../../core/stores/domain/ui-state";
import { act, fireEvent, render, screen } from "../../../core/test-utils";

const mockCommands = vi.hoisted(() => ({
  getCommitGraph: vi.fn().mockResolvedValue({
    status: "ok",
    data: { nodes: [], edges: [] },
  }),
  getCommitHistory: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  searchCommits: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  listBranches: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  listTags: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Panel: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({
    fitView: vi.fn(),
    getNodes: () => [],
    setCenter: vi.fn(),
  }),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
  Handle: () => null,
  BaseEdge: () => null,
  getStraightPath: () => ["", 0, 0],
  getBezierPath: () => ["", 0, 0],
}));

import { TopologyRootBlade } from "../blades/TopologyRootBlade";

function tab(name: "Graph" | "History"): HTMLElement {
  return screen.getByRole("button", { name });
}

describe("TopologyRootBlade", () => {
  beforeEach(() => {
    getNavigationActor().send({ type: "RESET_STACK" });
  });

  it("renders without crashing", () => {
    const { container } = render(<TopologyRootBlade />);
    expect(container.firstChild).not.toBeNull();
  });

  it("opens on the Graph tab by default", () => {
    render(<TopologyRootBlade />);
    expect(tab("Graph")).toHaveAttribute("aria-pressed", "true");
    expect(tab("History")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the History tab selected across a blade push/pop (blade remount)", () => {
    const { unmount } = render(<TopologyRootBlade />);
    fireEvent.click(tab("History"));
    expect(tab("History")).toHaveAttribute("aria-pressed", "true");
    expect(useUIStore.getState().topologyView).toBe("history");

    // Opening a commit pushes a blade on top; the root blade unmounts
    // (BladeContainer only renders the active blade fully). Going back pops
    // it and mounts the root again.
    act(() => {
      getNavigationActor().send({
        type: "PUSH_BLADE",
        bladeType: "commit-details",
        title: "abc1234",
        props: { oid: "abc1234" },
      });
    });
    unmount();
    act(() => {
      getNavigationActor().send({ type: "POP_BLADE" });
    });
    render(<TopologyRootBlade />);

    expect(tab("History")).toHaveAttribute("aria-pressed", "true");
    expect(tab("Graph")).toHaveAttribute("aria-pressed", "false");
  });

  it("switches back to the Graph tab when clicked", () => {
    useUIStore.getState().setTopologyView("history");
    render(<TopologyRootBlade />);
    fireEvent.click(tab("Graph"));
    expect(tab("Graph")).toHaveAttribute("aria-pressed", "true");
    expect(useUIStore.getState().topologyView).toBe("graph");
  });
});

describe("showTopologyView", () => {
  beforeEach(() => {
    getNavigationActor().send({ type: "RESET_STACK" });
  });

  afterEach(() => {
    useBladeRegistry.getState().unregister("topology-graph");
  });

  it("does nothing when the topology blade is not registered", () => {
    expect(showTopologyView("history")).toBe(false);
    expect(useUIStore.getState().topologyView).toBe("graph");
  });

  it("selects the History tab and switches to the topology workflow", () => {
    registerBlade({
      type: "topology-graph",
      title: "Topology",
      component: TopologyRootBlade,
      singleton: true,
    });

    expect(showTopologyView("history")).toBe(true);

    const snapshot = getNavigationActor().getSnapshot();
    expect(selectActiveWorkflow(snapshot)).toBe("topology");
    expect(selectBladeStack(snapshot)[0]?.type).toBe("topology-graph");
    expect(useUIStore.getState().topologyView).toBe("history");

    render(<TopologyRootBlade />);
    expect(tab("History")).toHaveAttribute("aria-pressed", "true");
  });
});
