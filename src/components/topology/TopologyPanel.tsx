import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import "@xyflow/react/dist/style.css";

import { Loader2 } from "lucide-react";
import type { BranchType } from "../../bindings";
import { useCommitGraph } from "../../hooks/useCommitGraph";
import { BranchEdge } from "./BranchEdge";
import { CommitBadge } from "./CommitBadge";
import { LaneHeader } from "./LaneHeader";
import {
  NODE_WIDTH,
  type CommitEdgeData,
  type CommitNodeData,
  layoutGraph,
} from "./layoutUtils";

const nodeTypes = { commit: CommitBadge };
const edgeTypes = { gitflow: BranchEdge };

interface TopologyPanelProps {
  onCommitSelect?: (oid: string) => void;
}

function TopologyPanelInner({ onCommitSelect }: TopologyPanelProps) {
  const {
    nodes: graphNodes,
    edges: graphEdges,
    isLoading,
    error,
    hasMore,
    selectedCommit,
    selectCommit,
    loadMore,
  } = useCommitGraph();

  const { setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSetInitialViewport = useRef(false);

  // Layout nodes using lane-based positioning
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (graphNodes.length === 0) {
      return {
        nodes: [] as Node<CommitNodeData>[],
        edges: [] as Edge<CommitEdgeData>[],
      };
    }
    return layoutGraph(graphNodes, graphEdges);
  }, [graphNodes, graphEdges]);

  // Add selection state to nodes
  const nodesWithHandlers = useMemo(() => {
    return layoutedNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedCommit,
      },
    }));
  }, [layoutedNodes, selectedCommit]);

  // Add index to edges for staggered animation
  const edgesWithIndex = useMemo(() => {
    return layoutedEdges.map((edge, index) => ({
      ...edge,
      data: {
        branchType: edge.data?.branchType || "other",
        index,
      } as CommitEdgeData,
    }));
  }, [layoutedEdges]);

  // Extract unique branch lanes for the lane header
  const laneInfo = useMemo(() => {
    const seen = new Map<
      string,
      { column: number; branchName: string; branchType: BranchType }
    >();
    for (const node of graphNodes) {
      for (const name of node.branchNames) {
        if (!seen.has(name)) {
          seen.set(name, {
            column: node.column,
            branchName: name,
            branchType: node.branchType,
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [graphNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CommitNodeData>>(
    [] as Node<CommitNodeData>[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CommitEdgeData>>(
    [] as Edge<CommitEdgeData>[],
  );

  // Update nodes when data changes
  useEffect(() => {
    setNodes(nodesWithHandlers);
    setEdges(edgesWithIndex);
  }, [nodesWithHandlers, edgesWithIndex, setNodes, setEdges]);

  // Center viewport on first commit after initial load
  useEffect(() => {
    if (
      hasSetInitialViewport.current ||
      layoutedNodes.length === 0 ||
      !containerRef.current
    )
      return;

    hasSetInitialViewport.current = true;

    // Wait a tick for React Flow to measure
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const firstNode = layoutedNodes[0];
      // Center the first node horizontally, 20px from top
      const nodeCenterX = firstNode.position.x + NODE_WIDTH / 2;
      const x = containerWidth / 2 - nodeCenterX;
      const y = -firstNode.position.y + 20;

      setViewport({ x, y, zoom: 1 }, { duration: 0 });
    });
  }, [layoutedNodes, setViewport]);

  // Handle node clicks via React Flow's onNodeClick
  const handleNodeClick: NodeMouseHandler<Node<CommitNodeData>> = useCallback(
    (_event, node) => {
      selectCommit(node.data.oid);
      onCommitSelect?.(node.data.oid);
    },
    [selectCommit, onCommitSelect],
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-red p-4">
        <div className="text-center">
          <p className="font-medium">Error loading commit graph</p>
          <p className="text-sm text-ctp-subtext0 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-mantle">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-overlay0" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-ctp-mantle text-ctp-overlay0">
        <p>No commits to display</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-ctp-mantle flex flex-col">
      <LaneHeader lanes={laneInfo} />
      <div className="flex-1 min-h-0 relative" ref={containerRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll
          zoomOnPinch
          panOnScroll={false}
          panOnDrag
          style={{ background: "transparent" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--ctp-surface0, #313244)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>

        {hasMore && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              onClick={loadMore}
              disabled={isLoading}
              className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-md hover:bg-ctp-blue/90 disabled:opacity-50 font-medium transition-colors"
            >
              {isLoading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TopologyPanel(props: TopologyPanelProps) {
  return (
    <ReactFlowProvider>
      <TopologyPanelInner {...props} />
    </ReactFlowProvider>
  );
}
