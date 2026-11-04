import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  dense?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, dense = false, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border border-input bg-background text-foreground shadow-xs transition-colors",
          "file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive",
          dense
            ? "h-7 px-2 py-0.5 text-[11px]"
            : "h-8 px-2.5 py-1 text-xs",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
