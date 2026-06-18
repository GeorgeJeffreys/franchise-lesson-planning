import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next 16 renamed the "middleware" file convention to "proxy".
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all request paths except static assets and image files. The
     * auth/session refresh and route protection happen in updateSession.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
