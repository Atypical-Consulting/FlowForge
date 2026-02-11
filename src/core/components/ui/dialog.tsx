import { type VariantProps, cva } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

// Context for managing dialog open state
interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

// DialogContent variants
const dialogContentVariants = cva(
  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl w-full p-6",
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
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogContentVariants> {}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, size, children, ...props }, ref) => {
    // Exclude HTML event handlers that conflict with framer-motion props
    const {
      onDrag: _1,
      onDragStart: _2,
      onDragEnd: _3,
      onDragOver: _4,
      onAnimationStart: _5,
      ...safeProps
    } = props;
    const { open, onOpenChange } = useDialogContext();
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Handle Escape key to close dialog
    React.useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onOpenChange]);

    // Auto-focus first focusable element when opened
    React.useEffect(() => {
      if (open && contentRef.current) {
        const focusable = contentRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      }
    }, [open]);

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
              onClick={() => onOpenChange(false)}
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
                (
                  contentRef as React.MutableRefObject<HTMLDivElement | null>
                ).current = node;
                if (typeof ref === "function") {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
              }}
              role="dialog"
              aria-modal="true"
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

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}

// DialogFooter
interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <div className={cn("flex justify-end gap-2", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
