/**
 * GitHub extension types and constants.
 *
 * Scope profiles for the sign-in wizard, auth step tracking,
 * and custom scope definitions for granular permission selection.
 */

export interface ScopeProfile {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  recommended?: boolean;
}

export const SCOPE_PROFILES: ScopeProfile[] = [
  {
    id: "basic",
    name: "Basic (Read Only)",
    description:
      "Read access to public repos, user profile, and organization membership",
    scopes: ["public_repo", "read:user", "user:email", "read:org"],
  },
  {
    id: "full",
    name: "Full Access",
    description:
      "Full repository access with user profile and organization membership",
    scopes: ["repo", "read:user", "user:email", "read:org"],
    recommended: true,
  },
  {
    id: "custom",
    name: "Custom",
    description: "Choose individual permissions",
    scopes: [],
  },
];

export type AuthStep =
  | "scopes"
  | "device-code"
  | "polling"
  | "success"
  | "error";

export interface CustomScope {
  id: string;
  label: string;
  description: string;
}

export const CUSTOM_SCOPES: CustomScope[] = [
  { id: "repo", label: "Repositories", description: "Full access to repos" },
  {
    id: "public_repo",
    label: "Public Repos Only",
    description: "Read-only for public repos",
  },
  {
    id: "read:user",
    label: "Read User Profile",
    description: "Read access to profile info",
  },
  {
    id: "user:email",
    label: "User Email",
    description: "Access to email addresses",
  },
  {
    id: "read:org",
    label: "Read Organizations",
    description: "Read organization membership",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Access to notifications",
  },
];
