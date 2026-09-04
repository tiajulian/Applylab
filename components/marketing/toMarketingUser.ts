import type { UserMenuProps } from "@/components/dashboard/UserAvatarMenu";
import type { CurrentUser } from "@/lib/getCurrentUser";

/** Builds the UserAvatarMenu prop shape from getCurrentUser()'s result, or null for a logged-out
 * (or anonymous mid-onboarding) visitor, who sees the Log in / Sign up CTAs instead. */
export function toMarketingUser(currentUser: CurrentUser | null): UserMenuProps | null {
  if (!currentUser || currentUser.isAnonymous) return null;
  return {
    email: currentUser.authEmail,
    fullName: currentUser.appUser?.full_name ?? undefined,
    avatarUrl: currentUser.avatarUrl,
    plan: currentUser.appUser?.plan ?? "free",
    isAdmin: currentUser.appUser?.is_admin ?? false,
  };
}
