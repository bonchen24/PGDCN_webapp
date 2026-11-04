"use client"

import * as React from "react"
import { Toaster as Sonner, toast } from "sonner"
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:text-xs group-[.toaster]:p-3 select-none",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:text-[11px] mt-0.5",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:h-7 group-[.toast]:px-2.5",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:h-7 group-[.toast]:px-2.5",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />,
        warning: <AlertTriangle className="size-4 text-amber-600 shrink-0" />,
        error: <AlertCircle className="size-4 text-destructive shrink-0" />,
        info: <Info className="size-4 text-blue-600 shrink-0" />,
        loading: <Loader2 className="size-4 text-primary animate-spin shrink-0" />,
      }}
      {...props}
    />
  )
}

/**
 * Standardized Vietnamese notification helpers
 */
export const notify = {
  success: (title: string, description?: string) => {
    toast.success(title, { description })
  },
  error: (title: string, error?: unknown) => {
    const description =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : undefined
    toast.error(title || "Đã xảy ra lỗi", { description })
  },
  warning: (title: string, description?: string) => {
    toast.warning(title, { description })
  },
  info: (title: string, description?: string) => {
    toast.info(title, { description })
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading?: string
      success: string | ((data: T) => string)
      error: string | ((err: unknown) => string)
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading || "Đang xử lý...",
      success: messages.success,
      error: messages.error,
    })
  },
}

export { Toaster, toast }
