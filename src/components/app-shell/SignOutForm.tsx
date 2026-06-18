import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/actions/auth";

/**
 * Sign-out control for the shell. A plain form posting to the signOut server
 * action keeps this server-rendered (no client JS) while clearing the session.
 */
export function SignOutForm() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary" size="sm">
        Sign out
      </Button>
    </form>
  );
}
