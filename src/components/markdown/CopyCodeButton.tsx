import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

interface CopyCodeButtonProps {
  code: string;
}

/**
 * Copy-to-clipboard button for code blocks.
 * Shows a checkmark confirmation for 2 seconds after copying.
 */
export function CopyCodeButton({ code }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts — fail silently
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded bg-ctp-surface0/80 hover:bg-ctp-surface1 text-ctp-overlay1 hover:text-ctp-text transition-colors"
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-ctp-green" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
