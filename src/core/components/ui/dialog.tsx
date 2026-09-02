import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Accessible modal dialog (WAI-ARIA dialog pattern).
 *
 * - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` -> DialogTitle
 * - Escape closes (unless `closeOnEscape={false}`)
 * - Backdrop click closes (unless `closeOnBackdropClick={false}`)
 * - Autofocuses the first form field (or `[data-autofocus]`) on open
 * - Traps Tab / Shift+Tab inside the dialog
 * - Restores focus to the previously focused element on close
 * - Only the top-most open dialog reacts to Escape / traps focus (nesting-safe)
 */

// Context for managing dialog open state
interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
}

// Dialog Root Component
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const id = React.useId();
  const value = React.useMemo(
    () => ({
      open,
      onOpenChange,
      titleId: `${id}-title`,
      descriptionId: `${id}-description`,
    }),
    [open, onOpenChange, id],
  );
  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Focus management helpers
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const FIELD_SELECTOR = [
  "input:not([disabled]):not([type='hidden']):not([type='checkbox']):not([type='radio'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(",");

function isVisible(el: HTMLElement): boolean {
  // Style-based check (works in jsdom, which has no layout engine).
  if (el.closest("[hidden]")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.getAttribute("aria-hidden") !== "true" && isVisible(el));
}

/** Pick the element to focus when the dialog opens. */
function getInitialFocusTarget(container: HTMLElement): HTMLElement {
  return (
    container.querySelector<HTMLElement>("[data-autofocus]") ??
    container.querySelector<HTMLElement>(FIELD_SELECTOR) ??
    getFocusable(container).find(
      (el) => el.getAttribute("aria-label") !== "Close",
    ) ??
    container
  );
}

/** Currently open dialog content nodes, in the order they were opened. */
const openDialogStack: HTMLElement[] = [];

/**
 * The top-most dialog is the most recently opened one that does not contain
 * another open dialog (nested dialogs register child-first in React, so a
 * plain "last pushed" check would pick the outer one).
 */
function isTopMost(node: HTMLElement | null): boolean {
  if (!node) return false;
  const leaves = openDialogStack.filter(
    (candidate) =>
      !openDialogStack.some(
        (other) => other !== candidate && candidate.contains(other),
      ),
  );
  return leaves[leaves.length - 1] === node;
}

// ---------------------------------------------------------------------------
// DialogContent
// ---------------------------------------------------------------------------

const dialogContentVariants = cva(
  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl w-full p-6 max-h-[90vh] overflow-y-auto focus:outline-none",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        default: "max-w-md",
        lg: "max-w-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogContentVariants> {
  /** Close when Escape is pressed. Default: true. */
  closeOnEscape?: boolean;
  /** Close when the backdrop is clicked. Default: true. */
  closeOnBackdropClick?: boolean;
  /** Element to focus on open (overrides the automatic first-field pick). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      size,
      children,
      closeOnEscape = true,
      closeOnBackdropClick = true,
      initialFocusRef,
      ...props
    },
    ref,
  ) => {
    // Exclude HTML event handlers that conflict with framer-motion props
    const {
      onDrag: _1,
      onDragStart: _2,
      onDragEnd: _3,
      onDragOver: _4,
      onAnimationStart: _5,
      ...safeProps
    } = props;
    const { open, onOpenChange, titleId, descriptionId } = useDialogContext();
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [hasDescription, setHasDescription] = React.useState(false);

    // Register in the open-dialog stack so only the top-most dialog reacts.
    React.useEffect(() => {
      if (!open) return;
      const node = contentRef.current;
      if (!node) return;
      openDialogStack.push(node);
      return () => {
        const idx = openDialogStack.lastIndexOf(node);
        if (idx !== -1) openDialogStack.splice(idx, 1);
      };
    }, [open]);

    // Detect whether a DialogDescription is present for aria-describedby.
    React.useEffect(() => {
      if (!open) return;
      setHasDescription(Boolean(document.getElementById(descriptionId)));
    }, [open, descriptionId]);

    // Escape closes (capture phase so global hotkeys such as "pop blade"
    // do not also fire while a modal is open).
    React.useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !isTopMost(contentRef.current)) return;
        e.preventDefault();
        e.stopPropagation();
        if (closeOnEscape) onOpenChange(false);
      };

      document.addEventListener("keydown", handleKeyDown, { capture: true });
      return () =>
        document.removeEventListener("keydown", handleKeyDown, {
          capture: true,
        });
    }, [open, onOpenChange, closeOnEscape]);

    // Focus trap: cycle Tab / Shift+Tab inside the dialog and pull focus
    // back if it ever lands outside.
    React.useEffect(() => {
      if (!open) return;

      const handleTab = (e: KeyboardEvent) => {
        const node = contentRef.current;
        if (e.key !== "Tab" || !node || !isTopMost(node)) return;

        const focusable = getFocusable(node);
        if (focusable.length === 0) {
          e.preventDefault();
          node.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = active !== null && node.contains(active);

        if (e.shiftKey) {
          if (!inside || active === first || active === node) {
            e.preventDefault();
            last.focus();
          }
        } else if (!inside || active === last) {
          e.preventDefault();
          first.focus();
        }
      };

      const handleFocusIn = (e: FocusEvent) => {
        const node = contentRef.current;
        if (!node || !isTopMost(node)) return;
        const target = e.target as Node | null;
        if (target && !node.contains(target)) {
          const focusable = getFocusable(node);
          (focusable[0] ?? node).focus();
        }
      };

      document.addEventListener("keydown", handleTab);
      document.addEventListener("focusin", handleFocusIn);
      return () => {
        document.removeEventListener("keydown", handleTab);
        document.removeEventListener("focusin", handleFocusIn);
      };
    }, [open]);

    // Autofocus first field on open; restore focus to the trigger on close.
    React.useEffect(() => {
      if (!open) return;
      const node = contentRef.current;
      if (!node) return;

      const previouslyFocused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const target = initialFocusRef?.current ?? getInitialFocusTarget(node);
      target.focus();
      if (target instanceof HTMLInputElement && target.type === "text") {
        // Place the caret at the end of any prefilled value.
        const len = target.value.length;
        target.setSelectionRange?.(len, len);
      }

      return () => {
        if (previouslyFocused?.isConnected) {
          previouslyFocused.focus();
        }
      };
    }, [open, initialFocusRef]);

    return (
      <AnimatePresence mode="wait">
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              data-testid="dialog-backdrop"
              onClick={() => {
                if (closeOnBackdropClick) onOpenChange(false);
              }}
              aria-hidden="true"
            />
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              ref={(node) => {
                // Handle both refs
                contentRef.current = node;
                if (typeof ref === "function") {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={hasDescription ? descriptionId : undefined}
              tabIndex={-1}
              className={cn(dialogContentVariants({ size, className }))}
              onClick={(e) => e.stopPropagation()}
              {...safeProps}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
DialogContent.displayName = "DialogContent";

// DialogHeader
interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

function DialogHeader({ className, children, ...props }: DialogHeaderProps) {
  const { onOpenChange } = useDialogContext();

  return (
    <div
      className={cn("flex items-center justify-between mb-4", className)}
      {...props}
    >
      {children}
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="p-1 hover:bg-ctp-surface0 rounded transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-ctp-subtext0" />
      </button>
    </div>
  );
}

// DialogTitle
interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

function DialogTitle({ className, id, ...props }: DialogTitleProps) {
  const { titleId } = useDialogContext();
  return (
    <h3
      id={id ?? titleId}
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

// DialogDescription
interface DialogDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

function DialogDescription({
  className,
  id,
  ...props
}: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext();
  return (
    <p
      id={id ?? descriptionId}
      className={cn("text-sm text-ctp-overlay1", className)}
      {...props}
    />
  );
}

// DialogFooter
interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <div className={cn("flex justify-end gap-2", className)} {...props} />;
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
