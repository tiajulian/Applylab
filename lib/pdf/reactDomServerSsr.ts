import type { ReactElement } from "react";
// @ts-expect-error - Next ships this vendored entrypoint without usable type declarations.
import ReactDOMServer from "next/dist/server/route-modules/app-page/vendored/ssr/react-dom-server";

/**
 * Stand-in for react-dom/server, aliased in ONLY for renderResumeMarkup.tsx when it is bundled by
 * Next (see next.config.mjs). A plain react-dom/server import there bundles a second React copy,
 * so every hook in the templates hits a null dispatcher. Next's vendored SSR renderer shares the
 * exact React the "ssr"-layer templates resolve to. Next stubs the legacy (sync) renderers in that
 * copy to throw, so this renders through the streaming API and waits for the whole document.
 * Async either way, so the call site matches the sync renderToStaticMarkup vitest uses.
 */
export async function renderToStaticMarkup(element: ReactElement): Promise<string> {
  const stream: ReadableStream<Uint8Array> & { allReady: Promise<void> } =
    await ReactDOMServer.renderToReadableStream(element);
  // Static export needs the complete markup, not progressive chunks.
  await stream.allReady;
  return new Response(stream).text();
}
