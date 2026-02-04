import { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCommitGraph } from "../../hooks/useCommitGraph";
import {
  layoutGraph,
  type CommitNodeData,
  type CommitEdgeData,
} from "./layoutUtils";
import { CommitNode } from "./CommitNode";
import { CommitEdge } from "./CommitEdge";
import { Loader2 } from "lucide-react";

const nodeTypes = { commit: CommitNode };
const edgeTypes = { gitflow: CommitEdge };

export function TopologyPanel() {
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
        onSelect: selectCommit,
      },
    }));
  }, [layoutedNodes, selectedCommit, selectCommit]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CommitNodeData>>(
    [] as Node<CommitNodeData>[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CommitEdgeData>>(
    [] as Edge<CommitEdgeData>[],
  );

  // Update nodes when data changes
  useEffect(() => {
    setNodes(nodesWithHandlers);
    setEdges(layoutedEdges);
  }, [nodesWithHandlers, layoutedEdges, setNodes, setEdges]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-4">
        <div className="text-center">
          <p className="font-medium">Error loading commit graph</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No commits to display</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
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
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {hasMore && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
