import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { InterviewSetup } from "@/components/interview/InterviewSetup";
import type { Resume } from "@/types";

export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();
  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.authUserId)
    .order("created_at", { ascending: false });

  return (
    <div className="w-full">
      <InterviewSetup
        resumes={(resumes || []) as Resume[]}
        user={user.appUser!}
      />
    </div>
  );
}
