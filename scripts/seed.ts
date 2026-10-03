import bcrypt from "bcryptjs";
import { detectAnomalies } from "../lib/anomaly";
import { categorizeUncategorizedForUser } from "../lib/categorize";
import { query } from "../lib/db";
import { DEMO_USER } from "../lib/demo";
import { embedTransactionsForUser } from "../lib/embeddings";
import { recommendSavingsGoals } from "../lib/goals";
import { attachGoalNarratives } from "../lib/goals-narrative";
import { provisionMockBankData } from "../lib/plaid";
import { latestCompleteMonth, listReportMonths, shiftMonth } from "../lib/report";
import { generateMonthlyReport } from "../lib/report-narrative";

async function ensureDemoUser() {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [DEMO_USER.email],
  );

  if (rows[0]?.id) {
    return rows[0].id;
  }

  const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);
  const inserted = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [DEMO_USER.email, passwordHash, DEMO_USER.name],
  );

  const id = inserted.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to create demo user.");
  }
  return id;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add a Postgres URL.");
  }

  const userId = await ensureDemoUser();
  const synced = await provisionMockBankData(userId);
  const categorized = await categorizeUncategorizedForUser(userId);
  const embedded = await embedTransactionsForUser(userId);
  const anomalies = await detectAnomalies(userId);
  const goals = await recommendSavingsGoals(userId);
  await attachGoalNarratives(userId);
  const months = await listReportMonths(userId);
  const latest = latestCompleteMonth(months);
  const reportMonths = [shiftMonth(latest, -1), latest];
  for (const month of reportMonths) {
    if (months.includes(month)) {
      await generateMonthlyReport(userId, month);
    }
  }

  console.log("Spendsense seed complete.");
  console.log(`Demo user id: ${userId}`);
  console.log(`Transactions upserted this run: ${synced.added}`);
  console.log(
    `Categorized: ${categorized.categorized} (${categorized.mock ? "keyword mock" : "Gemini"})`,
  );
  console.log(
    `Embedded: ${embedded.embedded} (${embedded.mock ? "mock vectors" : "text-embedding-004"})`,
  );
  console.log(`Anomaly alerts: ${anomalies.length}`);
  console.log(`Monthly reports: ${reportMonths.filter((month) => months.includes(month)).join(", ")}`);
  for (const goal of goals) {
    console.log(`  - ${goal.category}: ${goal.projectedMonthlySaving}/month`);
  }
  for (const anomaly of anomalies) {
    console.log(`  - ${anomaly.reason}`);
  }
  console.log("");
  console.log("Demo login");
  console.log(`  email:    ${DEMO_USER.email}`);
  console.log(`  password: ${DEMO_USER.password}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
