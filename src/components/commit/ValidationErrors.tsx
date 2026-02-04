import type { ValidationResult } from "../../bindings";

interface ValidationErrorsProps {
  validation: ValidationResult | null;
  isValidating: boolean;
}

export function ValidationErrors({
  validation,
  isValidating,
}: ValidationErrorsProps) {
  if (isValidating) {
    return (
      <div className="text-sm text-ctp-overlay1 animate-pulse">
        Validating...
      </div>
    );
  }

  if (!validation) return null;

  return (
    <div className="space-y-2">
      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="space-y-1">
          {validation.errors.map((error, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 bg-ctp-red/10 border border-ctp-red/20 rounded text-sm"
            >
              <span className="text-ctp-red shrink-0">✗</span>
              <div>
                <p className="text-ctp-red">{error.message}</p>
                {error.suggestion && (
                  <p className="text-ctp-overlay1 mt-1 text-xs">
                    {error.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="space-y-1">
          {validation.warnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 bg-ctp-yellow/10 border border-ctp-yellow/20 rounded text-sm"
            >
              <span className="text-ctp-yellow shrink-0">⚠</span>
              <p className="text-ctp-yellow">{warning.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Success */}
      {validation.isValid && validation.errors.length === 0 && (
        <div className="flex items-center gap-2 p-2 bg-ctp-green/10 border border-ctp-green/20 rounded text-sm">
          <span className="text-ctp-green">✓</span>
          <span className="text-ctp-green">Valid conventional commit</span>
        </div>
      )}
    </div>
  );
}
