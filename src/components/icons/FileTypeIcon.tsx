import { getFileIcon, getFolderIcon } from "../../lib/file-icons";
import { cn } from "../../lib/utils";

interface FileTypeIconProps {
  /** File path or filename to determine icon */
  path: string;
  /** Whether this is a directory */
  isDirectory?: boolean;
  /** Whether directory is expanded (only for directories) */
  isOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function FileTypeIcon({
  path,
  isDirectory = false,
  isOpen = false,
  className,
}: FileTypeIconProps) {
  const Icon = isDirectory ? getFolderIcon(isOpen) : getFileIcon(path);

  return (
    <Icon className={cn("w-4 h-4 shrink-0", className)} aria-hidden="true" />
  );
}
