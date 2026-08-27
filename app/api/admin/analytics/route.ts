import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";
import type { Plan } from "@/types";

export const dynamic = "force-dynamic";

export interface AdminAnalyticsData {
  overview: {
    totalUsers: number;
    usersLast7Days: number;
    usersLast30Days: number;
    paidUsers: number;
    paidConversionRate: number;
    planBreakdown: {
      free: number;
      pro: number;
      lifetime: number;
    };
    estimatedMrrAud: number;
    totalResumes: number;
    resumesLast30Days: number;
    resumesWithCoverLetter: number;
    avgAtsScore: number | null;
    avgContentScore: number | null;
    totalApplications: number;
    totalInterviews: number;
    totalInterviewTurns: number;
    avgInterviewScore: number | null;
    totalAiCostUsd: number;
    aiCostLast30DaysUsd: number;
    avgAiCostPerUserUsd: number;
    totalSkillsBridges: number;
  };
  signupTrends: Array<{
    date: string; // YYYY-MM-DD
    count: number;
  }>;
  aiCostTrends: Array<{
    date: string; // YYYY-MM-DD
    costUsd: number;
    calls: number;
  }>;
  aiProviderBreakdown: Array<{
    provider: string;
    costUsd: number;
    calls: number;
    percentage: number;
  }>;
  aiFeatureBreakdown: Array<{
    feature: string;
    costUsd: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  activationFunnel: {
    registered: number;
    profileCreated: number;
    profileComplete80Plus: number;
    resumesGenerated: number;
    applicationsTracked: number;
    interviewPracticed: number;
  };
  applicationPipeline: {
    applied: number;
    interviewing: number;
    offered: number;
    rejected: number;
    total: number;
  };
  topAiUsers: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    plan: Plan;
    totalCostUsd: number;
    totalCalls: number;
    resumesUsed: number;
  }>;
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, full_name, plan, resumes_used, onboarded, profile_completeness, created_at")
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;
    const allUsers = users ?? [];

    // 2. Fetch resumes metadata
    const { data: resumes, error: resumesError } = await supabase
      .from("resumes")
      .select("id, user_id, ats_score, content_score, cover_letter_content, template, created_at");

    if (resumesError) throw resumesError;
    const allResumes = resumes ?? [];

    // 3. Fetch applications metadata
    const { data: applications, error: appsError } = await supabase
      .from("applications")
      .select("id, user_id, status, created_at");

    if (appsError) throw appsError;
    const allApps = applications ?? [];

    // 4. Fetch interview sessions & turns
    const { data: interviews, error: interviewsError } = await supabase
      .from("interview_sessions")
      .select("id, user_id, stage_type, total_score, created_at");

    if (interviewsError) throw interviewsError;
    const allInterviews = interviews ?? [];

    const { count: turnsCount, error: turnsError } = await supabase
      .from("interview_turns")
      .select("id", { count: "exact", head: true });

    if (turnsError) throw turnsError;

    // 5. Fetch AI cost logs
    const { data: costLogs, error: costError } = await supabase
      .from("api_cost_log")
      .select("id, user_id, feature, provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at");

    if (costError) throw costError;
    const allCostLogs = costLogs ?? [];

    // 6. Fetch skills bridge count
    const { count: bridgesCount } = await supabase
      .from("skills_bridges")
      .select("id", { count: "exact", head: true });

    // --- AGGREGATIONS ---

    // Users & Growth
    const totalUsers = allUsers.length;
    const usersLast7Days = allUsers.filter((u) => u.created_at >= sevenDaysAgo).length;
    const usersLast30Days = allUsers.filter((u) => u.created_at >= thirtyDaysAgo).length;

    const planBreakdown = {
      free: 0,
      pro: 0,
      lifetime: 0,
    };
    allUsers.forEach((u) => {
      if (u.plan === "pro") planBreakdown.pro++;
      else if (u.plan === "lifetime") planBreakdown.lifetime++;
      else planBreakdown.free++;
    });

    const paidUsers = planBreakdown.pro + planBreakdown.lifetime;
    const paidConversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
    // Pro is $19 AUD / month
    const estimatedMrrAud = planBreakdown.pro * 19;

    // Resumes Stats
    const totalResumes = allResumes.length;
    const resumesLast30Days = allResumes.filter((r) => r.created_at >= thirtyDaysAgo).length;
    const resumesWithCoverLetter = allResumes.filter((r) => Boolean(r.cover_letter_content)).length;

    const scoredAtsResumes = allResumes.filter((r) => typeof r.ats_score === "number");
    const avgAtsScore =
      scoredAtsResumes.length > 0
        ? Math.round(
            scoredAtsResumes.reduce((acc, r) => acc + (r.ats_score ?? 0), 0) / scoredAtsResumes.length
          )
        : null;

    const scoredContentResumes = allResumes.filter((r) => typeof r.content_score === "number");
    const avgContentScore =
      scoredContentResumes.length > 0
        ? Math.round(
            scoredContentResumes.reduce((acc, r) => acc + (r.content_score ?? 0), 0) /
              scoredContentResumes.length
          )
        : null;

    // Application Pipeline
    const applicationPipeline = {
      applied: 0,
      interviewing: 0,
      offered: 0,
      rejected: 0,
      total: allApps.length,
    };
    allApps.forEach((a) => {
      const status = (a.status || "").toLowerCase();
      if (status === "interviewing") applicationPipeline.interviewing++;
      else if (status === "offered") applicationPipeline.offered++;
      else if (status === "rejected") applicationPipeline.rejected++;
      else applicationPipeline.applied++;
    });

    // Interviews
    const scoredInterviews = allInterviews.filter((i) => typeof i.total_score === "number");
    const avgInterviewScore =
      scoredInterviews.length > 0
        ? Math.round(
            scoredInterviews.reduce((acc, i) => acc + (i.total_score ?? 0), 0) / scoredInterviews.length
          )
        : null;

    // AI Costs
    let totalAiCostUsd = 0;
    let aiCostLast30DaysUsd = 0;
    const providerMap = new Map<string, { costUsd: number; calls: number }>();
    const featureMap = new Map<
      string,
      { costUsd: number; calls: number; inputTokens: number; outputTokens: number }
    >();
    const userCostMap = new Map<string, { costUsd: number; calls: number }>();
    const dailyCostMap = new Map<string, { costUsd: number; calls: number }>();

    allCostLogs.forEach((log) => {
      const cost = Number(log.estimated_cost_usd || 0);
      totalAiCostUsd += cost;

      if (log.created_at >= thirtyDaysAgo) {
        aiCostLast30DaysUsd += cost;
        const day = log.created_at.slice(0, 10);
        const currentDaily = dailyCostMap.get(day) || { costUsd: 0, calls: 0 };
        dailyCostMap.set(day, {
          costUsd: currentDaily.costUsd + cost,
          calls: currentDaily.calls + 1,
        });
      }

      // Provider breakdown
      const provider = log.provider || "anthropic";
      const currentProvider = providerMap.get(provider) || { costUsd: 0, calls: 0 };
      providerMap.set(provider, {
        costUsd: currentProvider.costUsd + cost,
        calls: currentProvider.calls + 1,
      });

      // Feature breakdown
      const feature = log.feature || "other";
      const currentFeature = featureMap.get(feature) || {
        costUsd: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      featureMap.set(feature, {
        costUsd: currentFeature.costUsd + cost,
        calls: currentFeature.calls + 1,
        inputTokens: currentFeature.inputTokens + Number(log.input_tokens || 0),
        outputTokens: currentFeature.outputTokens + Number(log.output_tokens || 0),
      });

      // User cost
      if (log.user_id) {
        const currentUserCost = userCostMap.get(log.user_id) || { costUsd: 0, calls: 0 };
        userCostMap.set(log.user_id, {
          costUsd: currentUserCost.costUsd + cost,
          calls: currentUserCost.calls + 1,
        });
      }
    });

    const avgAiCostPerUserUsd = totalUsers > 0 ? totalAiCostUsd / totalUsers : 0;

    // AI Provider breakdown array
    const aiProviderBreakdown = Array.from(providerMap.entries()).map(([provider, data]) => ({
      provider,
      costUsd: data.costUsd,
      calls: data.calls,
      percentage: totalAiCostUsd > 0 ? (data.costUsd / totalAiCostUsd) * 100 : 0,
    }));

    // AI Feature breakdown array
    const aiFeatureBreakdown = Array.from(featureMap.entries())
      .map(([feature, data]) => ({
        feature,
        costUsd: data.costUsd,
        calls: data.calls,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    // 30-Day Daily Signup Trends
    const dailySignupsMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailySignupsMap.set(key, 0);
    }
    allUsers.forEach((u) => {
      const day = u.created_at.slice(0, 10);
      if (dailySignupsMap.has(day)) {
        dailySignupsMap.set(day, (dailySignupsMap.get(day) ?? 0) + 1);
      }
    });

    const signupTrends = Array.from(dailySignupsMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // 30-Day Daily Cost Trends
    const aiCostTrends: Array<{ date: string; costUsd: number; calls: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = dailyCostMap.get(key) || { costUsd: 0, calls: 0 };
      aiCostTrends.push({
        date: key,
        costUsd: entry.costUsd,
        calls: entry.calls,
      });
    }

    // Activation Funnel
    const usersWithResumes = new Set(allResumes.map((r) => r.user_id));
    const usersWithApps = new Set(allApps.map((a) => a.user_id));
    const usersWithInterviews = new Set(allInterviews.map((i) => i.user_id));

    const activationFunnel = {
      registered: totalUsers,
      profileCreated: allUsers.filter((u) => u.onboarded).length,
      profileComplete80Plus: allUsers.filter((u) => Number(u.profile_completeness || 0) >= 80).length,
      resumesGenerated: usersWithResumes.size,
      applicationsTracked: usersWithApps.size,
      interviewPracticed: usersWithInterviews.size,
    };

    // Top AI Users
    const userLookup = new Map(allUsers.map((u) => [u.id, u]));
    const topAiUsers = Array.from(userCostMap.entries())
      .map(([userId, data]) => {
        const u = userLookup.get(userId);
        return {
          userId,
          email: u?.email || "Unknown",
          fullName: u?.full_name || null,
          plan: (u?.plan || "free") as Plan,
          totalCostUsd: data.costUsd,
          totalCalls: data.calls,
          resumesUsed: u?.resumes_used || 0,
        };
      })
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 10);

    const payload: AdminAnalyticsData = {
      overview: {
        totalUsers,
        usersLast7Days,
        usersLast30Days,
        paidUsers,
        paidConversionRate,
        planBreakdown,
        estimatedMrrAud,
        totalResumes,
        resumesLast30Days,
        resumesWithCoverLetter,
        avgAtsScore,
        avgContentScore,
        totalApplications: allApps.length,
        totalInterviews: allInterviews.length,
        totalInterviewTurns: turnsCount ?? 0,
        avgInterviewScore,
        totalAiCostUsd,
        aiCostLast30DaysUsd,
        avgAiCostPerUserUsd,
        totalSkillsBridges: bridgesCount ?? 0,
      },
      signupTrends,
      aiCostTrends,
      aiProviderBreakdown,
      aiFeatureBreakdown,
      activationFunnel,
      applicationPipeline,
      topAiUsers,
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin analytics error", error);
    return NextResponse.json({ error: "Failed to generate analytics" }, { status: 500 });
  }
}
