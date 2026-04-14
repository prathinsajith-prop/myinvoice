"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "#16a34a",
          "--success-text": "#ffffff",
          "--success-border": "#15803d",
          "--error-bg": "#dc2626",
          "--error-text": "#ffffff",
          "--error-border": "#b91c1c",
          "--warning-bg": "#d97706",
          "--warning-text": "#ffffff",
          "--warning-border": "#b45309",
          "--info-bg": "#2563eb",
          "--info-text": "#ffffff",
          "--info-border": "#1d4ed8",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
