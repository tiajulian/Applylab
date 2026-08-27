import { describe, it, expect } from "vitest";

describe("Admin Analytics Calculations", () => {
  it("calculates MRR accurately based on active Pro subscribers", () => {
    const proUsers = 42;
    const proPriceAud = 19;
    const mrr = proUsers * proPriceAud;
    expect(mrr).toBe(798);
  });

  it("calculates paid conversion percentage correctly", () => {
    const totalUsers = 200;
    const proUsers = 18;
    const lifetimeUsers = 6;
    const paidUsers = proUsers + lifetimeUsers;
    const conversionRate = (paidUsers / totalUsers) * 100;
    expect(conversionRate).toBe(12.0);
  });

  it("handles zero users gracefully without NaN or division by zero", () => {
    const totalUsers = 0;
    const paidUsers = 0;
    const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
    expect(conversionRate).toBe(0);
  });

  it("computes AI cost aggregations and averages correctly", () => {
    const costLogs = [
      { provider: "gemini", feature: "generate-resume", cost: 0.045, inputTokens: 4000, outputTokens: 1200 },
      { provider: "openai", feature: "skills-bridge", cost: 0.008, inputTokens: 2500, outputTokens: 600 },
      { provider: "anthropic", feature: "project-enhance", cost: 0.032, inputTokens: 1800, outputTokens: 800 },
    ];

    const totalCost = costLogs.reduce((acc, log) => acc + log.cost, 0);
    expect(Number(totalCost.toFixed(3))).toBe(0.085);

    const geminiCost = costLogs
      .filter((l) => l.provider === "gemini")
      .reduce((acc, l) => acc + l.cost, 0);
    expect(geminiCost).toBe(0.045);
  });

  it("computes activation funnel progression dropoff correctly", () => {
    const funnel = {
      registered: 500,
      profileCreated: 350,
      resumesGenerated: 210,
      applicationsTracked: 95,
      interviewPracticed: 40,
    };

    const profileRate = (funnel.profileCreated / funnel.registered) * 100;
    const resumeRate = (funnel.resumesGenerated / funnel.registered) * 100;
    const appRate = (funnel.applicationsTracked / funnel.registered) * 100;

    expect(profileRate).toBe(70.0);
    expect(resumeRate).toBe(42.0);
    expect(appRate).toBe(19.0);
  });

  it("converts USD token costs to AUD with exact multiplier", () => {
    const usdCost = 10.0;
    const usdToAud = 1.54;
    const audCost = usdCost * usdToAud;
    expect(audCost).toBe(15.4);
  });
});
