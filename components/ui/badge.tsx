import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring select-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/20",
        outline:
          "text-foreground border-border",
        success:
          "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300",
        warning:
          "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300",
        info:
          "border-blue-200/80 bg-blue-50 text-blue-800 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-300",
      },
      size: {
        default: "px-2 py-0.5 text-[11px] leading-4",
        sm: "px-1.5 py-0.25 text-[10px] leading-tight",
        lg: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            variant === "success" && "bg-emerald-600 animate-pulse",
            variant === "warning" && "bg-amber-600",
            variant === "info" && "bg-blue-600",
            variant === "destructive" && "bg-destructive",
            (!variant || variant === "default") && "bg-primary-foreground",
            variant === "secondary" && "bg-secondary-foreground"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
