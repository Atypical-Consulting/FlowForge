# Research: Phase 05 - Topology Visualization

**Phase Goal**: User sees commit graph with color-coded Gitflow lanes showing branch relationships
**Requirement**: FLOW-11 - Topology panel displays branches with color-coded Gitflow lanes
**Research Date**: 2026-02-04

## Executive Summary

This phase implements a visual DAG (Directed Acyclic Graph) showing commits with parent-child relationships and Gitflow-colored branch lanes. The recommended stack is **@xyflow/react** (React Flow) v12.x for the graph rendering combined with **@dagrejs/dagre** for automatic hierarchical layout. This integrates well with the existing React 19 + Tailwind stack.

## 1. Technology Selection

### Graph Visualization Library: React Flow (@xyflow/react)

**Why React Flow:**
- Modern React library specifically for node-based graphs
- Built-in pan, zoom, and viewport management
- Custom node rendering with full React component support
- Virtual rendering for performance (only renders visible nodes)
- Active maintenance and excellent documentation
- MIT licensed

**Alternatives Considered:**
| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| D3.js | Powerful, flexible | Low-level, steep learning curve | Too complex for this use case |
| vis.js | Feature-rich | Heavier, jQuery-era patterns | Dated architecture |
| Cytoscape.js | Excellent for graphs | Overkill, complex API | More than needed |
| React Flow | React-native, custom nodes | None significant | ✓ Best fit |

### Layout Algorithm: Dagre (@dagrejs/dagre)

**Why Dagre:**
- Designed specifically for DAG layouts
- Produces hierarchical tree-like structures
- Integrates seamlessly with React Flow
- Handles complex merge patterns well
- Lightweight (~30KB)

## 2. Backend Architecture

### New Rust Module: `graph.rs`

Location: `src-tauri/src/git/graph.rs`

**Core Data Structures:**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GraphNode {
    pub oid: String,              // Commit SHA
    pub short_oid: String,        // Short SHA (7 chars)
    pub message: String,          // First line of commit message
    pub author: String,
    pub timestamp: i64,
    pub parents: Vec<String>,     // Parent commit SHAs
    pub branch_type: BranchType,  // For Gitflow coloring
    pub column: usize,            // Lane position (0-indexed from left)
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum BranchType {
    Main,
    Develop,
    Feature,
    Release,
    Hotfix,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GraphEdge {
    pub from: String,  // Child commit SHA
    pub to: String,    // Parent commit SHA
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CommitGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}
```

**IPC Command:**

```rust
#[tauri::command]
#[specta::specta]
pub async fn get_commit_graph(
    state: State<'_, AppState>,
    path: PathBuf,
    limit: Option<usize>,      // Default 100, max 500
    offset: Option<usize>,     // For pagination
) -> Result<CommitGraph, GitError>
```

### Implementation Approach

1. **Revwalk with Topological Sorting:**
   ```rust
   let mut revwalk = repo.revwalk()?;
   revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
   revwalk.push_head()?;
   // Push all branch heads for complete graph
   for branch in repo.branches(Some(BranchType::Local))? {
       revwalk.push(branch.0.get().peel_to_commit()?.id())?;
   }
   ```

2. **Branch-to-Commit Mapping:**
   Build a HashMap<Oid, Vec<String>> mapping commit OIDs to branch names that point to them or contain them in their history.

3. **Gitflow Type Detection:**
   ```rust
   fn classify_branch(name: &str) -> BranchType {
       if name == "main" || name == "master" { BranchType::Main }
       else if name == "develop" || name == "dev" { BranchType::Develop }
       else if name.starts_with("feature/") { BranchType::Feature }
       else if name.starts_with("release/") { BranchType::Release }
       else if name.starts_with("hotfix/") { BranchType::Hotfix }
       else { BranchType::Other }
   }
   ```

4. **Lane Assignment Algorithm:**
   - Process commits in topological order
   - First parent gets same column as child (linear history)
   - Other parents get new columns
   - Reuse columns when branches merge
   - Track active columns with a stack/set

## 3. Frontend Architecture

### Component Structure

```
src/components/topology/
├── TopologyPanel.tsx       # Main panel container
├── CommitNode.tsx          # Custom React Flow node
├── CommitEdge.tsx          # Custom edge with Gitflow colors
├── TopologyControls.tsx    # Zoom/pan controls
├── useCommitGraph.ts       # Data fetching hook
└── layoutUtils.ts          # Dagre layout helpers
```

### React Flow Setup

```typescript
// TopologyPanel.tsx
import { ReactFlow, Controls, Background } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = { commit: CommitNode };
const edgeTypes = { gitflow: CommitEdge };

export function TopologyPanel() {
  const { nodes, edges, isLoading } = useCommitGraph();
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onlyRenderVisibleElements={true}
      fitView
    >
      <Controls />
      <Background />
    </ReactFlow>
  );
}
```

### Custom Commit Node

```typescript
// CommitNode.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

const CommitNode = memo(({ data }: NodeProps) => {
  return (
    <div 
      className={cn(
        "px-3 py-2 rounded-lg border-2 cursor-pointer",
        getNodeStyles(data.branchType)
      )}
      onClick={() => data.onSelect(data.oid)}
    >
      <Handle type="target" position={Position.Top} />
      <div className="text-xs font-mono">{data.shortOid}</div>
      <div className="text-sm truncate max-w-[200px]">{data.message}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
```

## 4. Gitflow Color Scheme

Based on standard Gitflow visualization conventions:

| Branch Type | Color | Tailwind Class | Hex |
|-------------|-------|----------------|-----|
| Main | Orange | `border-orange-500` | #f97316 |
| Develop | Green | `border-green-500` | #22c55e |
| Feature | Blue | `border-blue-500` | #3b82f6 |
| Release | Purple | `border-purple-500` | #a855f7 |
| Hotfix | Red | `border-red-500` | #ef4444 |
| Other | Gray | `border-gray-500` | #6b7280 |

**Visual Design Notes:**
- Use filled backgrounds with lighter tint of the branch color
- Edges should use same color as their source branch
- Currently selected commit should have ring/glow effect
- HEAD indicator with special styling

## 5. Performance Optimizations

### Backend

1. **Pagination**: Default 100 commits, load more on scroll
2. **Caching**: Cache graph structure, invalidate on repo changes
3. **spawn_blocking**: All git2-rs calls wrapped (existing pattern)
4. **Limit branch traversal**: Only traverse active branches

### Frontend

1. **React Flow's Virtual Rendering**: `onlyRenderVisibleElements={true}`
2. **Memoized Components**: `React.memo()` on CommitNode
3. **Memoized Layout**: Cache dagre calculations with useMemo
4. **Debounced Selection**: Prevent rapid re-renders on click
5. **Lazy Edge Rendering**: Only compute visible edges

### Benchmark Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Initial render | <200ms | 100 commits |
| Pan/zoom | 60fps | React Flow handles this |
| Node click | <50ms | Selection only |
| Load more | <100ms | Additional 100 commits |

## 6. Integration Points

### Existing UI Integration

The TopologyPanel will integrate into the existing RepositoryView layout:

1. **Sidebar Location**: New "Topology" item in navigation
2. **State Management**: New Zustand store for graph state
3. **Interaction with CommitDetails**: Clicking node shows commit in existing detail panel

### Store Structure

```typescript
// src/stores/topologyStore.ts
interface TopologyState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedCommit: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadGraph: (path: string, limit?: number) => Promise<void>;
  selectCommit: (oid: string) => void;
  loadMore: () => Promise<void>;
}
```

## 7. Dependencies to Add

```json
{
  "@xyflow/react": "^12.0.0",
  "@dagrejs/dagre": "^1.1.0",
  "@types/dagre": "^0.7.x"
}
```

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large repos (100k+ commits) | Performance | Aggressive pagination, virtual scroll |
| Complex merge patterns | Layout chaos | Dagre handles, may need tuning |
| Cross-browser edge rendering | Visual bugs | Test on Chrome, Firefox, Safari |
| React Flow v12 breaking changes | Dev time | Pin version, read migration guide |

## 9. Recommended Plan Structure

**Wave 1 (Backend):**
- Plan 01: Rust graph module with commit walking and lane assignment
- Plan 02: IPC command registration and type generation

**Wave 2 (Frontend):**
- Plan 03: Topology store and data fetching
- Plan 04: React Flow setup with custom nodes and edges
- Plan 05: UI integration and commit selection

## 10. References

- [React Flow Documentation](https://reactflow.dev/docs/introduction)
- [Dagre Wiki](https://github.com/dagrejs/dagre/wiki)
- [git2-rs Revwalk API](https://docs.rs/git2/latest/git2/struct.Revwalk.html)
- [Drawing Commit Graphs - DoltHub](https://www.dolthub.com/blog/2024-08-07-drawing-a-commit-graph/)
- [Commit Graph Drawing Algorithms](https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html)
- [Gitflow Branch Colors](https://www.theserverside.com/infographic/A-better-Gitflow-diagram-with-branches-merges-and-color)

---

## RESEARCH COMPLETE

Research findings documented. Ready for planning phase.
