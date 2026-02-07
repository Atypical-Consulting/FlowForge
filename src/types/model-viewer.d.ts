/**
 * JSX type declarations for @google/model-viewer web component.
 *
 * model-viewer ships with TypeScript types for HTMLElementTagNameMap but
 * does NOT declare JSX.IntrinsicElements. This file bridges the gap
 * so <model-viewer> can be used in React/JSX without type errors.
 */

declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        poster?: string;
        loading?: "auto" | "lazy" | "eager";
        reveal?: "auto" | "manual";
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        "auto-rotate-delay"?: number;
        "rotation-per-second"?: string;
        "shadow-intensity"?: string;
        "shadow-softness"?: string;
        "environment-image"?: string;
        exposure?: string;
        "camera-orbit"?: string;
        "camera-target"?: string;
        "field-of-view"?: string;
        "min-camera-orbit"?: string;
        "max-camera-orbit"?: string;
        "interaction-prompt"?: "auto" | "none";
        "touch-action"?: string;
        ar?: boolean;
        "ar-modes"?: string;
      },
      HTMLElement
    >;
  }
}
