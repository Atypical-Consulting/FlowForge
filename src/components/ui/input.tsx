import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const inputVariants = cva(
  "w-full bg-ctp-surface0 border border-ctp-surface1 rounded text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  {
    variants: {
      inputSize: {
        sm: "px-2 py-1.5 text-xs",
        default: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  },
);

export interface InputProps
  extends
    React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

const textareaVariants = cva(
  "w-full bg-ctp-surface0 border border-ctp-surface1 rounded text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-none",
  {
    variants: {
      inputSize: {
        sm: "px-2 py-1.5 text-xs",
        default: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  },
);

export interface TextareaProps
  extends
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, inputSize, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Input, inputVariants, Textarea, textareaVariants };
