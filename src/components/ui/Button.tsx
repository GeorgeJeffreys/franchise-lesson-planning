import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const BASE =
  "inline-flex items-center justify-center gap-[11px] font-semibold cursor-pointer " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2";

const VARIANTS: Record<Variant, string> = {
  // Teal CTA — the login "Sign in with Microsoft" action.
  primary: "bg-teal text-white border border-teal hover:bg-[#1a6a5d]",
  // White surface with a warm border — the shell's quieter actions.
  secondary:
    "bg-surface text-ink border border-border-strong hover:bg-surface-subtle",
};

const SIZES: Record<Size, string> = {
  sm: "text-[13px] px-[13px] py-[7px] rounded-sm",
  md: "text-[15px] px-[15px] py-[15px] rounded-md",
};

/**
 * The single Button primitive for this slice. Variants and sizes mirror what the
 * Login and shell designs use; the set grows per page later.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}
