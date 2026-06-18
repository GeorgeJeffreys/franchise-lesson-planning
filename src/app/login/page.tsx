/**
 * Public placeholder route. The real Microsoft SSO login UI is built in the
 * auth phase; for now this only needs to exist as the unauthenticated redirect
 * target so the middleware boundary can be exercised.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-4 text-sm text-gray-500">
        Microsoft SSO sign-in is coming in the next phase.
      </p>
    </main>
  );
}
