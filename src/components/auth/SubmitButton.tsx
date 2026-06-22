"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * Submit button for the auth forms. `useFormStatus` reflects the enclosing
 * <form action={serverAction}>'s in-flight state, so the button lightens, shows
 * a spinner, and disables itself while the action runs — no per-form client
 * state needed. Must be a descendant of the <form> it submits.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
}: {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" pending={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
