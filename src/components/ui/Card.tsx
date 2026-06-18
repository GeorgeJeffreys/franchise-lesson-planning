import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * A white surface panel with the design's warm border, large radius and soft
 * card shadow. The login two-pane container and shell body sit on this.
 */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-lg shadow-card overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}
