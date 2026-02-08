# Phase 25: Test Infrastructure Foundation - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Vitest with jsdom, typed Tauri IPC mocks, and Zustand auto-reset so all subsequent v1.4.0 architectural changes are verifiable through unit tests. This phase delivers developer tooling only — no end-user features.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User deferred all implementation decisions to Claude. The following areas are open for Claude to decide during research and planning:

**Mock strategy:**
- How Tauri IPC mocks are structured (factory functions, fixtures, or inline)
- Fidelity level of mock responses relative to real Tauri bindings
- Type-safety approach for mock factories

**Test organization:**
- File placement (co-located vs separate directory)
- Naming convention (*.test.ts vs *.spec.ts)
- Test utility and helper organization

**Coverage & CI expectations:**
- Whether to enforce coverage thresholds in this phase
- Which test types run in CI vs locally only
- Fail-on-regression policy

**Smoke test scope:**
- Which blade types get smoke tests (all vs representative subset)
- Depth of smoke tests (render-only vs basic interaction)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow ecosystem conventions (Vitest + React Testing Library patterns) and optimize for developer ergonomics.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-test-infrastructure-foundation*
*Context gathered: 2026-02-08*
