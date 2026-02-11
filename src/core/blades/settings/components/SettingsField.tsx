interface SettingsFieldProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function SettingsField({ label, description, htmlFor, children }: SettingsFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ctp-subtext1 mb-2"
      >
        {label}
      </label>
      {description && (
        <p className="text-xs text-ctp-subtext0 mb-2">{description}</p>
      )}
      {children}
    </div>
  );
}
