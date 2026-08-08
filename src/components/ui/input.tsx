import * as React from "react"
import { cn } from "@/lib/utils"
import { BROWSER_AUTOFILL_OFF_PROPS } from "@/lib/browserAutofill"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const searchAutofillDefaults =
      type === "search" ? BROWSER_AUTOFILL_OFF_PROPS : null

    return (
      <input
        type={type}
        className={cn("app-input", className)}
        ref={ref}
        {...searchAutofillDefaults}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
