import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import {
  listSavingsGoals,
  saveGoalNarratives,
  type SavedGoal,
} from "./goals";
import { isGeminiConfigured } from "./llm";
import { formatInr } from "./money";

export function mockGoalNarrative(goal: {
  category: string;
  currentMonthlyAvg: number;
  projectedMonthlySaving: number;
  suggestedTrimPct: number;
}) {
  const trim = `${Math.round(goal.suggestedTrimPct * 100)}%`;
  const subject = goal.category === "overall" ? "discretionary spending" : goal.category;
  return `Trimming ${subject} by ${trim} turns a ${formatInr(goal.currentMonthlyAvg)} monthly average into ${formatInr(goal.projectedMonthlySaving)} saved each month.`;
}

const narrativeSchema = z.array(
  z.object({
    category: z.string(),
    narrative: z.string(),
  }),
);

export async function explainSavingsGoals(goals: SavedGoal[]) {
  const open = goals.filter((goal) => goal.status !== "dismissed");
  if (!isGeminiConfigured() || open.length === 0) {
    return open.map((goal) => ({
      category: goal.category,
      narrative: mockGoalNarrative(goal),
    }));
  }

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });

  try {
    const result = await model.generateContent(
      `Write one short encouragement sentence per savings goal.
Use ONLY the provided numbers. Do not invent figures.
Return JSON array [{"category":"...","narrative":"..."}].

${JSON.stringify(
  open.map((goal) => ({
    category: goal.category,
    currentMonthlyAvg: goal.currentMonthlyAvg,
    projectedMonthlySaving: goal.projectedMonthlySaving,
    suggestedTrimPct: goal.suggestedTrimPct,
  })),
)}`,
    );
    const parsed = narrativeSchema.safeParse(JSON.parse(result.response.text()));
    if (parsed.success && parsed.data.length > 0) {
      return parsed.data;
    }
  } catch {
    // fall through to templates
  }

  return open.map((goal) => ({
    category: goal.category,
    narrative: mockGoalNarrative(goal),
  }));
}

export async function attachGoalNarratives(userId: string) {
  const goals = await listSavingsGoals(userId);
  const narratives = await explainSavingsGoals(goals);
  await saveGoalNarratives(userId, narratives);
  return narratives;
}
