import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";
import type { Plan } from "@/types";

export const dynamic = "force-dynamic";

// Standard exchange rate for currency conversion (1 USD = 1.54 AUD)
const USD_TO_AUD = 1.54;

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
    totalAiCostAud: number;
    aiCostLast30DaysAud: number;
    avgAiCostPerUserAud: number;
    totalSkillsBridges: number;
  };
  signupTrends: Array<{
    date: string; // YYYY-MM-DD
    count: number;
  }>;
  aiCostTrends: Array<{
    date: string; // YYYY-MM-DD
    costAud: number;
    calls: number;
  }>;
  aiProviderBreakdown: Array<{
    provider: string;
    costAud: number;
    calls: number;
    percentage: number;
  }>;
  aiFeatureBreakdown: Array<{
    feature: string;
    costAud: number;
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
    totalCostAud: number;
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

    if (usersError) {
      console.error("analytics users query failed:", usersError);
      throw usersError;
    }
    const allUsers = users ?? [];

    // 2. Fetch resumes metadata
    const { data: resumes, error: resumesError } = await supabase
      .from("resumes")
      .select("id, user_id, ats_score, cover_letter_content, template, created_at");

    if (resumesError) {
      console.error("analytics resumes query failed:", resumesError);
      throw resumesError;
    }
    const allResumes = resumes ?? [];

    // 3. Fetch applications metadata
    const { data: applications, error: appsError } = await supabase
      .from("applications")
      .select("id, user_id, status, created_at");

    if (appsError) {
      console.error("analytics applications query failed:", appsError);
    }
    const allApps = applications ?? [];

    // 4. Fetch interview sessions & turns
    const { data: interviews, error: interviewsError } = await supabase
      .from("interview_sessions")
      .select("id, user_id, stage_type, overall_score, created_at");

    if (interviewsError) {
      console.error("analytics interviews query failed:", interviewsError);
    }
    const allInterviews = interviews ?? [];

    const { count: turnsCount, error: turnsError } = await supabase
      .from("interview_turns")
      .select("id", { count: "exact", head: true });

    if (turnsError) {
      console.error("analytics turns query failed:", turnsError);
    }

    // 5. Fetch AI cost logs
    const { data: costLogs, error: costError } = await supabase
      .from("api_cost_log")
      .select("id, user_id, feature, provider, model, input_tokens, output_tokens, estimated_cost_usd, created_at");

    if (costError) {
      console.error("analytics cost logs query failed:", costError);
    }
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
    const scoredInterviews = allInterviews.filter((i) => typeof i.overall_score === "number");
    const avgInterviewScore =
      scoredInterviews.length > 0
        ? Math.round(
            scoredInterviews.reduce((acc, i) => acc + (i.overall_score ?? 0), 0) / scoredInterviews.length
          )
        : null;

    // AI Costs in AUD
    let totalAiCostAud = 0;
    let aiCostLast30DaysAud = 0;
    const providerMap = new Map<string, { costAud: number; calls: number }>();
    const featureMap = new Map<
      string,
      { costAud: number; calls: number; inputTokens: number; outputTokens: number }
    >();
    const userCostMap = new Map<string, { costAud: number; calls: number }>();
    const dailyCostMap = new Map<string, { costAud: number; calls: number }>();

    allCostLogs.forEach((log) => {
      const costUsd = Number(log.estimated_cost_usd || 0);
      const costAud = costUsd * USD_TO_AUD;
      totalAiCostAud += costAud;

      if (log.created_at >= thirtyDaysAgo) {
        aiCostLast30DaysAud += costAud;
        const day = log.created_at.slice(0, 10);
        const currentDaily = dailyCostMap.get(day) || { costAud: 0, calls: 0 };
        dailyCostMap.set(day, {
          costAud: currentDaily.costAud + costAud,
          calls: currentDaily.calls + 1,
        });
      }

      // Provider breakdown
      const provider = log.provider || "anthropic";
      const currentProvider = providerMap.get(provider) || { costAud: 0, calls: 0 };
      providerMap.set(provider, {
        costAud: currentProvider.costAud + costAud,
        calls: currentProvider.calls + 1,
      });

      // Feature breakdown
      const feature = log.feature || "other";
      const currentFeature = featureMap.get(feature) || {
        costAud: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      featureMap.set(feature, {
        costAud: currentFeature.costAud + costAud,
        calls: currentFeature.calls + 1,
        inputTokens: currentFeature.inputTokens + Number(log.input_tokens || 0),
        outputTokens: currentFeature.outputTokens + Number(log.output_tokens || 0),
      });

      // User cost
      if (log.user_id) {
        const currentUserCost = userCostMap.get(log.user_id) || { costAud: 0, calls: 0 };
        userCostMap.set(log.user_id, {
          costAud: currentUserCost.costAud + costAud,
          calls: currentUserCost.calls + 1,
        });
      }
    });

    const avgAiCostPerUserAud = totalUsers > 0 ? totalAiCostAud / totalUsers : 0;

    // AI Provider breakdown array
    const aiProviderBreakdown = Array.from(providerMap.entries()).map(([provider, data]) => ({
      provider,
      costAud: data.costAud,
      calls: data.calls,
      percentage: totalAiCostAud > 0 ? (data.costAud / totalAiCostAud) * 100 : 0,
    }));

    // AI Feature breakdown array
    const aiFeatureBreakdown = Array.from(featureMap.entries())
      .map(([feature, data]) => ({
        feature,
        costAud: data.costAud,
        calls: data.calls,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
      }))
      .sort((a, b) => b.costAud - a.costAud);

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
    const aiCostTrends: Array<{ date: string; costAud: number; calls: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = dailyCostMap.get(key) || { costAud: 0, calls: 0 };
      aiCostTrends.push({
        date: key,
        costAud: entry.costAud,
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
          totalCostAud: data.costAud,
          totalCalls: data.calls,
          resumesUsed: u?.resumes_used || 0,
        };
      })
      .sort((a, b) => b.totalCostAud - a.totalCostAud)
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
        avgContentScore: null,
        totalApplications: allApps.length,
        totalInterviews: allInterviews.length,
        totalInterviewTurns: turnsCount ?? 0,
        avgInterviewScore,
        totalAiCostAud,
        aiCostLast30DaysAud,
        avgAiCostPerUserAud,
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
    const message = error instanceof Error ? error.message : "Failed to generate analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
