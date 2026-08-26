import { Button, type ButtonProps } from "@/components/ui/Button";
import { NAV_COPY } from "@/lib/copy";

/**
 * Single source of truth for the "create a resume" action across the header, empty states,
 * and documents view. Swaps to the upgrade path once the free lifetime quota is exhausted so
 * there is never more than one primary create/upgrade CTA on screen at once.
 */
export function CreateResumeCta({
  limitReached,
  variant = "primary",
  size,
}: {
  limitReached: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  if (limitReached) {
    return (
      <Button href="/upgrade" size={size}>
        Upgrade to continue
      </Button>
    );
  }

  return (
    <Button href="/resume/new" variant={variant} size={size}>
      {NAV_COPY.newResume}
    </Button>
  );
}
