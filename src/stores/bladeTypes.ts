import type { DiffSource } from "../components/blades/DiffBlade";

/**
 * Central map: blade type → required props.
 * Adding a new blade type = adding one entry here.
 */
export interface BladePropsMap {
  "staging-changes": Record<string, never>;
  "topology-graph": Record<string, never>;
  "commit-details": { oid: string };
  "diff": { source: DiffSource };
  "viewer-nupkg": { filePath: string };
  "viewer-image": { filePath: string; oid?: string };
  "viewer-markdown": { filePath: string };
  "viewer-3d": { filePath: string };
  "repo-browser": { path?: string };
  "settings": Record<string, never>;
  "changelog": Record<string, never>;
  "gitflow-cheatsheet": Record<string, never>;
}

/** Derived from the map — single source of truth */
export type BladeType = keyof BladePropsMap;

/** A type-safe blade with discriminated props */
export type TypedBlade = {
  [K in BladeType]: {
    id: string;
    type: K;
    title: string;
    props: BladePropsMap[K];
  };
}[BladeType];
