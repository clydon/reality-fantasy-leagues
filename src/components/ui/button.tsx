import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Variants ported 1:1 from public/styles.css's button.btn/.btn.secondary/.btn.danger/.btn.small
// rules -- a translation, not shadcn's own defaults. Every value below (padding, radius,
// font-size, the exact hover/active treatment) is copied from that CSS, not approximated.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap outline-none select-none font-semibold rounded-[6px] shadow-sm transition-[filter,transform] hover:brightness-[1.06] active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // button.btn
        default: "bg-primary text-primary-foreground",
        // button.btn.secondary
        secondary: "border border-border bg-card text-foreground shadow-none hover:bg-secondary",
        // button.btn.danger
        destructive: "bg-destructive text-white",
      },
      size: {
        // button.btn (base): padding 8px 15px, font-size .85rem
        default: "px-[15px] py-2 text-[0.85rem]",
        // button.btn.small: padding 5px 10px, font-size .75rem
        sm: "px-2.5 py-[5px] text-[0.75rem]",
        // No original CSS rule for this one -- the live app's bet-card controls were always
        // bespoke, one-off classes (.btn-cancel/.btn-submit/etc, see bet-card.tsx), not a variant
        // of .btn. This is new design for the same dense-card-grid job: guess/propose/grade
        // controls packed several to a row inside a ~280px-wide card.
        xs: "px-2 py-1 text-[0.7rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
