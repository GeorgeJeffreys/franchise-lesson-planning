// Render a React-PDF document to an inline `application/pdf` HTTP response.
//
// Used by the /api/pdf route handlers. `renderToBuffer` requires the Node
// runtime (the routes set `runtime = 'nodejs'`). The buffer is wrapped in a
// fresh Uint8Array so it is a valid web `BodyInit`. Responses are `no-store`:
// plans change and are RLS-scoped per user, so they must never be cached.

import { renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export async function pdfResponse(
  // Accept any element: our top level is a wrapper component that returns a
  // <Document>, which react-pdf renders fine at runtime even though its types
  // expect the literal Document element. Narrow for renderToBuffer at the call.
  document: ReactElement,
  filename: string,
): Promise<Response> {
  const buffer = await renderToBuffer(
    document as ReactElement<DocumentProps>,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
