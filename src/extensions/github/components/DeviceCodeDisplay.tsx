/**
 * Device code display for the GitHub OAuth Device Flow.
 *
 * Shows the user code in large monospace text with copy/open buttons,
 * a countdown timer, and a polling spinner.
 */

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";

interface DeviceCodeDisplayProps {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  onCancel: () => void;
}

export function DeviceCodeDisplay({
  userCode,
  verificationUri,
  expiresAt,
  onCancel,
}: DeviceCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  );

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleCopy = async () => {
    try {
      // Use navigator.clipboard (works in Tauri webview and browsers)
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard is unavailable
    }
  };

  const handleOpenBrowser = async () => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(verificationUri);
    } catch {
      // Fallback to window.open
      window.open(verificationUri, "_blank");
    }
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Instructions */}
      <div className="text-center space-y-1">
        <p className="text-sm text-ctp-subtext1">
          Enter this code on GitHub to authorize FlowForge:
        </p>
      </div>

      {/* Large code display */}
      <div className="w-full p-6 bg-ctp-surface0 border-2 border-ctp-blue/30 rounded-xl flex items-center justify-center">
        <span className="font-mono text-3xl font-bold tracking-[0.3em] text-ctp-text select-all">
          {userCode}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-ctp-green" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Code
            </>
          )}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleOpenBrowser}
          className="gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open GitHub
        </Button>
      </div>

      {/* Polling status */}
      <div className="flex items-center gap-2 text-sm text-ctp-subtext1">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Waiting for authorization...</span>
      </div>

      {/* Countdown */}
      <p className="text-xs text-ctp-overlay0">
        Expires in {minutes}:{seconds.toString().padStart(2, "0")}
      </p>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="text-sm text-ctp-subtext0 hover:text-ctp-subtext1 underline"
      >
        Cancel and go back
      </button>
    </div>
  );
}
