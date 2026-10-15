import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium gap-1",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-foreground border-border",
        profit: "bg-profit/10 text-profit border-profit/20",
        loss: "bg-loss/10 text-loss border-loss/20",
        warning: "bg-warning/10 text-warning border-warning/20",
        accent: "bg-accent/10 text-accent border-accent/20",
        outline: "bg-transparent text-muted border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
