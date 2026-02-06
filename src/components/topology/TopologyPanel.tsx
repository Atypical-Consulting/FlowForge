import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";

import { Loader2 } from "lucide-react";
import type { BranchType } from "../../bindings";
import { useCommitGraph } from "../../hooks/useCommitGraph";
import { BranchEdge } from "./BranchEdge";
import { CommitBadge } from "./CommitBadge";
import { LaneHeader } from "./LaneHeader";
import {
  type CommitEdgeData,
  type CommitNodeData,
  layoutGraph,
} from "./layoutUtils";

const nodeTypes = { commit: CommitBadge };
const edgeTypes = { gitflow: BranchEdge };

interface TopologyPanelProps {
  onCommitSelect?: (oid: string) => void;
}

export function TopologyPanel({ onCommitSelect }: TopologyPanelProps) {
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

  // Layout nodes using dagre
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (graphNodes.length === 0) {
      return {
        nodes: [] as Node<CommitNodeData>[],
        edges: [] as Edge<CommitEdgeData>[],
      };
    }
    return layoutGraph(graphNodes, graphEdges);
  }, [graphNodes, graphEdges]);

  // Add selection state and handlers to nodes
  const nodesWithHandlers = useMemo(() => {
    return layoutedNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedCommit,
        onSelect: (oid: string) => {
          selectCommit(oid);
          onCommitSelect?.(oid);
        },
      },
    }));
  }, [layoutedNodes, selectedCommit, selectCommit, onCommitSelect]);

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
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
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
