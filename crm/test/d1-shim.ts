// Minimal D1Database-compatible shim backed by better-sqlite3, for unit
// tests that exercise real SQL business logic (lib/services/*) without a
// live Cloudflare Worker / wrangler dev process. Implements only the
// surface this codebase actually calls (see cloudflare-env.d.ts).
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

class D1PreparedStatementShim implements D1PreparedStatement {
  constructor(
    private db: Database.Database,
    private sql: string,
    private params: unknown[] = []
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new D1PreparedStatementShim(this.db, this.sql, values);
  }

  // Synchronous core (better-sqlite3 has no async API); the public methods
  // below just wrap this in a resolved Promise to match the D1 interface.
  // `batch()` calls this directly so multi-statement writes actually
  // happen inside one synchronous transaction instead of being scheduled
  // as out-of-order microtasks.
  _runSync<T = unknown>(): D1Result<T> {
    const stmt = this.db.prepare(this.sql);
    if (stmt.reader) {
      const rows = stmt.all(...this.params) as T[];
      return {
        results: rows,
        success: true,
        meta: { changes: 0, duration: 0, last_row_id: 0, rows_read: rows.length, rows_written: 0 },
      };
    }
    const info = stmt.run(...this.params);
    return {
      results: [],
      success: true,
      meta: {
        changes: info.changes,
        duration: 0,
        last_row_id: Number(info.lastInsertRowid),
        rows_read: 0,
        rows_written: info.changes,
      },
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params);
    return (row as T) ?? null;
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    return this._runSync<T>();
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...this.params) as T[];
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
  constructor(private db: Database.Database) {}

  prepare(query: string): D1PreparedStatement {
    return new D1PreparedStatementShim(this.db, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const tx = this.db.transaction(() => {
      return statements.map((stmt) => (stmt as D1PreparedStatementShim)._runSync<T>());
    });
    return tx();
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.db.exec(query);
    return { count: 0, duration: 0 };
  }
}

export function createTestDb(): D1Database {
  const sqlite = new Database(":memory:");
  const migrationsDir = join(__dirname, "..", "migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    sqlite.exec(sql);
  }
  return new D1Shim(sqlite);
}
