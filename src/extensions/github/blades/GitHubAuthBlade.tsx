/**
 * GitHub sign-in wizard blade.
 *
 * Multi-step flow:
 * 1. Scope selection (Basic / Full Access / Custom)
 * 2. Device code display with copy/open/countdown
 * 3. Success screen with username and auto-close
 * 4. Error state with retry
 */

import { motion } from "framer-motion";
import { AlertTriangle, Check, Github } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/framework/lib/utils";
import { Button } from "../../../core/components/ui/button";
import { useBladeNavigation } from "../../../core/hooks/useBladeNavigation";
import { DeviceCodeDisplay } from "../components/DeviceCodeDisplay";
import { ScopeSelector } from "../components/ScopeSelector";
import { useGitHubStore } from "../githubStore";
import type { AuthStep } from "../types";
import { SCOPE_PROFILES } from "../types";

const STEP_LABELS = ["Permissions", "Authorize", "Done"];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pb-4 border-b border-ctp-surface0">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                i < currentStep
                  ? "bg-ctp-green text-ctp-base"
                  : i === currentStep
                    ? "bg-ctp-blue text-ctp-base"
                    : "bg-ctp-surface1 text-ctp-overlay0",
              )}
            >
              {i < currentStep ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs",
                i === currentStep
                  ? "text-ctp-text font-medium"
                  : "text-ctp-overlay0",
              )}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={cn(
                "w-8 h-px",
                i < currentStep ? "bg-ctp-green" : "bg-ctp-surface1",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function GitHubAuthBlade() {
  const { goBack } = useBladeNavigation();

  // Store state
  const authStep = useGitHubStore((s) => s.authStep);
  const userCode = useGitHubStore((s) => s.userCode);
  const verificationUri = useGitHubStore((s) => s.verificationUri);
  const expiresAt = useGitHubStore((s) => s.expiresAt);
  const username = useGitHubStore((s) => s.username);
  const avatarUrl = useGitHubStore((s) => s.avatarUrl);
  const scopes = useGitHubStore((s) => s.scopes);
  const authError = useGitHubStore((s) => s.authError);
  const startDeviceFlow = useGitHubStore((s) => s.startDeviceFlow);
  const cancelAuth = useGitHubStore((s) => s.cancelAuth);

  // Local state for scope selection (persists across step navigation)
  const [selectedProfile, setSelectedProfile] = useState("full");
  const [customScopes, setCustomScopes] = useState<string[]>([]);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-close on success
  useEffect(() => {
    if (authStep === "success") {
      autoCloseRef.current = setTimeout(() => {
        goBack();
      }, 3000);
    }
    return () => {
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
      }
    };
  }, [authStep, goBack]);

  const handleContinue = () => {
    const profile = SCOPE_PROFILES.find((p) => p.id === selectedProfile);
    const selectedScopes =
      selectedProfile === "custom" ? customScopes : (profile?.scopes ?? []);

    if (selectedScopes.length === 0) return;
    startDeviceFlow(selectedScopes);
  };

  // Map authStep to step index
  const stepIndex: Record<AuthStep, number> = {
    scopes: 0,
    "device-code": 1,
    polling: 1,
    success: 2,
    error: 1,
  };

  const canContinue =
    selectedProfile === "custom" ? customScopes.length > 0 : true;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <Github className="w-6 h-6 text-ctp-text" />
          <h2 className="text-lg font-semibold text-ctp-text">
            Sign in to GitHub
          </h2>
        </div>
        <StepIndicator currentStep={stepIndex[authStep]} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Step 1: Scope Selection */}
        {authStep === "scopes" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-ctp-text mb-1">
                Choose permissions
              </h3>
              <p className="text-xs text-ctp-subtext0">
                Select the access level FlowForge should have for your GitHub
                account.
              </p>
            </div>

            <ScopeSelector
              selectedProfile={selectedProfile}
              onSelect={setSelectedProfile}
              customScopes={customScopes}
              onCustomScopesChange={setCustomScopes}
            />

            <div className="flex justify-end">
              <Button
                variant="default"
                onClick={handleContinue}
                disabled={!canContinue}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Device Code */}
        {(authStep === "device-code" || authStep === "polling") &&
          userCode &&
          verificationUri &&
          expiresAt && (
            <DeviceCodeDisplay
              userCode={userCode}
              verificationUri={verificationUri}
              expiresAt={expiresAt}
              onCancel={cancelAuth}
            />
          )}

        {/* Step 3: Success */}
        {authStep === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-4 py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <Check className="w-16 h-16 text-ctp-green" />
            </motion.div>

            {avatarUrl && (
              <img
                src={avatarUrl}
                alt={username ?? "GitHub avatar"}
                className="w-16 h-16 rounded-full border-2 border-ctp-surface1"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}

            <p className="text-lg font-medium text-ctp-text">
              Welcome, @{username}!
            </p>

            {scopes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-0.5 text-xs bg-ctp-surface0 text-ctp-subtext1 rounded-full"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={goBack}>
              Done
            </Button>

            <p className="text-xs text-ctp-overlay0">
              Auto-closing in a few seconds...
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {authStep === "error" && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <AlertTriangle className="w-12 h-12 text-ctp-red" />
            <p className="text-sm text-ctp-red text-center">{authError}</p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={cancelAuth}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
