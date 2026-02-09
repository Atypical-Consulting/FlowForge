import { render } from "../../test-utils/render";

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

vi.mock("../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-reactflow">{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn(), getNodes: () => [], setCenter: vi.fn() }),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
  Handle: () => null,
  BaseEdge: () => null,
  getStraightPath: () => ["", 0, 0],
  getBezierPath: () => ["", 0, 0],
}));

import { TopologyRootBlade } from "./TopologyRootBlade";

describe("TopologyRootBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<TopologyRootBlade />);
    expect(container.firstChild).not.toBeNull();
  });
});
