import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

type CachedPool = {
  url: string;
  pool: Pool;
};

const globalForDb = globalThis as unknown as {
  spendsensePool?: CachedPool;
};

function databaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return connectionString;
}

function isDroppedConnection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /connection terminated|connection ended|connection closed|econnreset|socket|fetch failed/i.test(
    message,
  );
}

function dropPool(pool: Pool) {
  if (globalForDb.spendsensePool?.pool === pool) {
    globalForDb.spendsensePool = undefined;
  }
  void pool.end().catch(() => undefined);
}

function createPool(url: string) {
  const pool = new Pool({ connectionString: url, max: 5 });
  pool.on("error", (error: Error) => {
    console.error("Postgres connection dropped:", error.message);
    dropPool(pool);
  });
  return pool;
}

export function getPool(): Pool {
  const url = databaseUrl();
  const cached = globalForDb.spendsensePool;
  if (cached && cached.url === url) {
    return cached.pool;
  }
  if (cached) {
    dropPool(cached.pool);
  }
  const pool = createPool(url);
  globalForDb.spendsensePool = { url, pool };
  return pool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pool = getPool();
    let release: (() => void) | undefined;
    try {
      const client = await pool.connect();
      release = () => client.release();
      const result = await client.query(text, values);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount,
      };
    } catch (error) {
      lastError = error;
      dropPool(pool);
      if (!isDroppedConnection(error) || attempt === 1) {
        throw error;
      }
    } finally {
      release?.();
    }
  }
  throw lastError;
}
