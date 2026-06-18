"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign the current user out and return them to the public login screen. Wired to
 * the shell's sign-out control via a plain <form action={signOut}> — no client
 * component needed. The auth'd server client clears the session cookies.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
