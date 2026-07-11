import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva("", {
  variants: {
    variant: {
      default: "bg-background",
      muted: "bg-muted",
      dark: "bg-primary text-primary-foreground",
      transparent: "bg-transparent",
    },
    spacing: {
      default: "py-section md:py-section-md lg:py-section-lg",
      compact: "py-section-compact md:py-section-compact-md",
      none: "",
    },
  },
  defaultVariants: {
    variant: "default",
    spacing: "default",
  },
})

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, variant, spacing, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(sectionVariants({ variant, spacing }), className)}
      {...props}
    />
  )
)
Section.displayName = "Section"

export { Section, sectionVariants }
