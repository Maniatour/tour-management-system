import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionHeaderVariants = cva("mb-8 md:mb-12", {
  variants: {
    align: {
      left: "text-left",
      center: "mx-auto max-w-3xl text-center",
    },
    size: {
      section: "",
      page: "",
    },
  },
  defaultVariants: {
    align: "left",
    size: "section",
  },
})

const titleVariants = cva("font-semibold tracking-tight text-foreground", {
  variants: {
    size: {
      section: "text-section-title",
      page: "text-page-title",
    },
  },
  defaultVariants: {
    size: "section",
  },
})

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof sectionHeaderVariants> {
  heading: React.ReactNode
  subtitle?: React.ReactNode
  /** Optional action slot (e.g. link or button) aligned opposite the heading on desktop */
  action?: React.ReactNode
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  (
    { className, align, size, heading, subtitle, action, ...props },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        sectionHeaderVariants({ align, size }),
        action && "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
      {...props}
    >
      <div className={cn(align === "center" && !action && "mx-auto")}>
        <h2 className={cn(titleVariants({ size }))}>{heading}</h2>
        {subtitle ? (
          <p className="mt-3 text-body max-w-2xl">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
)
SectionHeader.displayName = "SectionHeader"

export { SectionHeader, sectionHeaderVariants }
