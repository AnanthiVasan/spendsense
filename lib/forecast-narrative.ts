import { GoogleGenerativeAI } from "@google/generative-ai";
import { isGeminiConfigured } from "./llm";
import { formatInr } from "./money";
import { forecastCashflow, type ForecastResult } from "./forecast";

const GEMINI_MODEL = "gemini-1.5-flash";

export function mockExplainForecast(forecast: ForecastResult) {
  const { summary, horizonDays, startingBalance } = forecast;
  const recurring =
    summary.recurringItems.length === 0
      ? "No recurring rent, EMI, or salary items were detected."
      : `Detected recurring items: ${summary.recurringItems
          .map((item) => `${item.label} (${item.cadence}, ${formatInr(item.amount)})`)
          .join("; ")}.`;
  const risk = summary.firstNegativeDay
    ? `Projected balance first goes negative on ${summary.firstNegativeDay} (low ${formatInr(summary.lowestBalance)}).`
    : `The projected balance stays non-negative, with a low of ${formatInr(summary.lowestBalance)}.`;

  return [
    `Over the next ${horizonDays} days, starting from an assumed ${formatInr(startingBalance)}, inflows total ${formatInr(summary.totalProjectedInflow)} and outflows total ${formatInr(summary.totalProjectedOutflow)}.`,
    `The projected end balance is ${formatInr(summary.projectedEndBalance)}.`,
    recurring,
    risk,
  ].join(" ");
}

function prompt(forecast: ForecastResult) {
  return `You are Spendsense's cash-flow narrator.
Write 3-5 concise sentences explaining the forecast.
Use ONLY these computed numbers. Do not invent figures. Do not do arithmetic.
Mention the computed recurring items, the projected end balance, and any tight/negative-balance day already identified.

${JSON.stringify(
    {
      horizonDays: forecast.horizonDays,
      startingBalance: forecast.startingBalance,
      summary: forecast.summary,
      samplePoints: forecast.points.filter((_, index) => index % 7 === 0),
    },
    null,
    2,
  )}`;
}

export async function explainForecast(_userId: string, forecast: ForecastResult) {
  if (!isGeminiConfigured()) {
    return mockExplainForecast(forecast);
  }

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.2 },
  });
  const result = await model.generateContent(prompt(forecast));
  return result.response.text().trim() || mockExplainForecast(forecast);
}

type Cached = {
  key: string;
  payload: { forecast: ForecastResult; narrative: string; mock: boolean };
};

const cache = new Map<string, Cached>();

export async function getForecastPayload(userId: string) {
  const forecast = await forecastCashflow(userId);
  const cacheKey = `${userId}:${forecast.asOf}:${forecast.horizonDays}:${forecast.startingBalance}`;
  const hit = cache.get(userId);
  if (hit && hit.key === cacheKey) {
    return hit.payload;
  }

  const narrative = await explainForecast(userId, forecast);
  const payload = {
    forecast,
    narrative,
    mock: !isGeminiConfigured(),
  };
  cache.set(userId, { key: cacheKey, payload });
  return payload;
}
