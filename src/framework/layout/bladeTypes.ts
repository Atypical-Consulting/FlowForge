/**
 * Generic blade type system.
 *
 * Apps extend `BladePropsMap` via module augmentation to register
 * domain-specific blade types. The framework only knows about the
 * shape — never the concrete entries.
 *
 * Example augmentation (in app code):
 * ```ts
 * declare module "@/framework/layout/bladeTypes" {
 *   interface BladePropsMap {
 *     "my-blade": { someId: string };
 *   }
 * }
 * ```
 */

/** Base blade props map — apps extend via module augmentation */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BladePropsMap {}

/** Core blade types derived from the map */
export type CoreBladeType = keyof BladePropsMap;

/** Extension blade types follow ext:{extensionId}:{bladeName} convention */
export type ExtensionBladeType = `ext:${string}:${string}`;

/** Widened union: core blades + extension blades */
export type BladeType = CoreBladeType | ExtensionBladeType;

/** Runtime type guard: returns true for core blade types (not extension types) */
export function isCoreBladeType(type: BladeType): type is CoreBladeType {
  return !type.startsWith("ext:");
}

/** A type-safe blade with discriminated props */
export type TypedBlade =
  | {
      [K in CoreBladeType]: {
        id: string;
        type: K;
        title: string;
        props: BladePropsMap[K];
      };
    }[CoreBladeType]
  | { id: string; type: ExtensionBladeType; title: string; props: Record<string, unknown> };
