import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ctp-overlay0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-ctp-blue text-ctp-base shadow hover:bg-ctp-blue/90",
        destructive: "bg-ctp-red text-ctp-base shadow-sm hover:bg-ctp-red/90",
        outline:
          "border border-ctp-surface1 bg-transparent shadow-sm hover:bg-ctp-surface0 hover:text-ctp-text",
        secondary:
          "bg-ctp-surface1 text-ctp-text shadow-sm hover:bg-ctp-surface0",
        ghost: "hover:bg-ctp-surface0 hover:text-ctp-text",
        link: "text-ctp-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
