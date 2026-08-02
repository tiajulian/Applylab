"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TERMS_VERSION } from "@/lib/terms";

export function AcceptTermsForm({ redirectedFrom }: { redirectedFrom: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!agreed) return;
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("accept_terms", {
      p_version: TERMS_VERSION,
    });

    setIsLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.push(redirectedFrom);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Checkbox
        id="agreeTermsGate"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        label={
          <>
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:text-accent-hover"
            >
              Terms and Conditions
            </Link>
            .
          </>
        }
      />

      {error && <p className="text-sm text-critical">{error}</p>}

      <Button className="w-full" isLoading={isLoading} disabled={!agreed} onClick={handleAccept}>
        Continue
      </Button>
    </div>
  );
}
