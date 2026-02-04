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
      <div className="text-sm text-gray-400 animate-pulse">Validating...</div>
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
              className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm"
            >
              <span className="text-red-400 shrink-0">✗</span>
              <div>
                <p className="text-red-400">{error.message}</p>
                {error.suggestion && (
                  <p className="text-gray-400 mt-1 text-xs">
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
              className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm"
            >
              <span className="text-yellow-400 shrink-0">⚠</span>
              <p className="text-yellow-400">{warning.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Success */}
      {validation.isValid && validation.errors.length === 0 && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-sm">
          <span className="text-green-400">✓</span>
          <span className="text-green-400">Valid conventional commit</span>
        </div>
      )}
    </div>
  );
}
