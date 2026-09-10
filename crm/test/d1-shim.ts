// Minimal D1Database-compatible shim backed by Node's built-in `node:sqlite`
// module, for unit tests that exercise real SQL business logic
// (lib/services/*) without a live Cloudflare Worker / wrangler dev process.
// Deliberately NOT using the `better-sqlite3` npm package here: it needs a
// native addon built via node-gyp (Python + a C++ toolchain), which is a
// real deploy blocker on a fresh Windows machine. `node:sqlite` ships with
// Node itself (stable enough for this test-only use since Node 22.5+), so
// `npm install` never needs to compile anything.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

class D1PreparedStatementShim implements D1PreparedStatement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: unknown[] = []
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new D1PreparedStatementShim(this.db, this.sql, values);
  }

  // Synchronous core (node:sqlite has no async API); the public methods
  // below just wrap this in a resolved Promise to match the D1 interface.
  // `batch()` calls this directly so multi-statement writes actually
  // happen inside one synchronous transaction instead of being scheduled
  // as out-of-order microtasks. Only ever used for write statements
  // (INSERT/UPDATE) in this codebase, so it always uses `.run()`.
  _runSync<T = unknown>(): D1Result<T> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.params as never[]));
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes),
        duration: 0,
        last_row_id: Number(info.lastInsertRowid),
        rows_read: 0,
        rows_written: Number(info.changes),
      },
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.params as never[]));
    return (row as T) ?? null;
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    return this._runSync<T>();
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...(this.params as never[])) as T[];
    return {
      results: rows,
      success: true,
      meta: { changes: 0, duration: 0, last_row_id: 0, rows_read: rows.length, rows_written: 0 },
    };
  }

  async raw<T = unknown>(): Promise<T[]> {
    const { results } = await this.all<T>();
    return results;
  }
}

export class D1Shim implements D1Database {
  constructor(private db: DatabaseSync) {}

  prepare(query: string): D1PreparedStatement {
    return new D1PreparedStatementShim(this.db, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.db.exec("BEGIN");
    try {
      const results = statements.map((stmt) => (stmt as D1PreparedStatementShim)._runSync<T>());
      this.db.exec("COMMIT");
      return results;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.db.exec(query);
    return { count: 0, duration: 0 };
  }
}

export function createTestDb(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  const migrationsDir = join(__dirname, "..", "migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    sqlite.exec(sql);
  }
  return new D1Shim(sqlite);
}
