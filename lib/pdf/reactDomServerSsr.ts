import type { ReactElement } from "react";
// @ts-expect-error - Next ships this vendored entrypoint without type declarations.
import { renderToReadableStream } from "next/dist/server/future/route-modules/app-page/vendored/ssr/react-dom-server-edge";

/**
 * Stand-in for react-dom/server, aliased in ONLY for renderResumeMarkup.tsx when it is bundled by
 * Next (see next.config.mjs). A plain react-dom/server import there bundles a second React copy,
 * so every hook in the templates hits a null dispatcher. Next's vendored SSR renderer shares the
 * exact React the "ssr"-layer templates resolve to. Async because it is stream-based; the real
 * (sync) renderToStaticMarkup used by vitest is compatible with the same `await` call site.
 */
export async function renderToStaticMarkup(element: ReactElement): Promise<string> {
  const stream: ReadableStream<Uint8Array> & { allReady: Promise<void> } = await renderToReadableStream(element);
  // Static export needs the complete markup, not progressive chunks.
  await stream.allReady;
  return new Response(stream).text();
}
