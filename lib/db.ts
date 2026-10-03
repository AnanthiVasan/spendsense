import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

type QueryablePool = {
  connect: () => Promise<{
    query: (
      text: string,
      values?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    release: () => void;
  }>;
  end: () => Promise<void>;
  on: (event: "error", listener: (error: Error) => void) => void;
};

type CachedPool = {
  url: string;
  pool: QueryablePool;
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

/** Local Postgres (CI / Docker) needs the `pg` TCP driver; Neon uses the serverless WebSocket pool. */
export function usesLocalPostgres(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /@localhost\b|@127\.0\.0\.1\b/.test(url);
  }
}

function isDroppedConnection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /connection terminated|connection ended|connection closed|econnreset|socket|fetch failed/i.test(
    message,
  );
}

function dropPool(pool: QueryablePool) {
  if (globalForDb.spendsensePool?.pool === pool) {
    globalForDb.spendsensePool = undefined;
  }
  void pool.end().catch(() => undefined);
}

function createPool(url: string): QueryablePool {
  const pool = usesLocalPostgres(url)
    ? (new PgPool({ connectionString: url, max: 5 }) as unknown as QueryablePool)
    : (new NeonPool({ connectionString: url, max: 5 }) as unknown as QueryablePool);

  pool.on("error", (error: Error) => {
    console.error("Postgres connection dropped:", error.message);
    dropPool(pool);
  });
  return pool;
}

export function getPool(): QueryablePool {
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
