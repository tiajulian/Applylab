"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { dropSearchParam } from "@/lib/url/dropSearchParam";

/**
 * Runs `onSet` once, after mount, if the page was opened with `?<name>=1` (e.g. a dashboard
 * shortcut asking a page to open its form), then removes the flag from the URL so Back or a
 * refresh doesn't trigger it again. After mount, so anything it opens only renders in the browser.
 */
export function useQueryFlag(name: string, onSet: () => void): void {
  const searchParams = useSearchParams();
  const onSetRef = useRef(onSet);
  onSetRef.current = onSet;
  const isSet = searchParams?.get(name) === "1";

  useEffect(() => {
    if (!isSet) return;
    onSetRef.current();
    dropSearchParam(name);
  }, [isSet, name]);
}
