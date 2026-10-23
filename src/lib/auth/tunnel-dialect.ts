/**
 * GĐ 162 (PA-A): Kysely dialect cho Better Auth chạy QUA TUNNEL — SQL Server
 * GiongDB tại máy công ty (thay Neon). Gọi `tunnelQueryRun` của db.ts (POST
 * /query {text, params} → {rows}; API Server tự dịch PG→T-SQL).
 *
 * Compiler: dùng PostgresQueryCompiler như pglite-dialect — SQL PG-style phát
 * sinh ($1, quoted camelCase identifier, returning...) được API Server tự dịch
 * sang T-SQL trước khi chạy. Single-connection + queue giống hệt pglite-dialect
 * (tunnel API xử lý tuần tự — an toàn khi request auth đến song song).
 */
import {
  CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  type TransactionSettings,
} from "kysely";
import { tunnelQueryRun } from "../db";

/** Factory dùng trong `auth/server.ts`: `tunnelDialect()`. */
export function tunnelDialect(): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new LazyTunnelDriver(),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector =>
      new PostgresIntrospector(db),
  };
}

class LazyTunnelDriver implements Driver {
  private connection: TunnelConnection | undefined;
  private queue: Array<(con: TunnelConnection) => void> = [];

  async init(): Promise<void> {
    // Không cần init gì — runner tự fetch mỗi query.
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    if (this.connection !== undefined) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.connection = new TunnelConnection();
    return this.connection;
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection !== this.connection) {
      throw new Error("Invalid connection");
    }
    const next = this.queue.shift();
    if (next === undefined) {
      this.connection = undefined;
      return;
    }
    next(this.connection);
  }

  async beginTransaction(
    _conn: DatabaseConnection,
    _settings: TransactionSettings,
  ): Promise<void> {
    // NO-OP: HTTP tunnel stateless — begin/commit qua request khác nhau vô
    // nghĩa. Mỗi statement tự commit (autocommit); auth dùng per-statement,
    // chấp nhận được (ghi chú GĐ 162).
  }

  async commitTransaction(_conn: DatabaseConnection): Promise<void> {
    // NO-OP — xem beginTransaction.
  }

  async rollbackTransaction(_conn: DatabaseConnection): Promise<void> {
    // NO-OP — xem beginTransaction.
  }

  async destroy(): Promise<void> {
    this.connection = undefined;
    this.queue = [];
  }
}

class TunnelConnection implements DatabaseConnection {
  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const rows = await tunnelQueryRun<O>(
      compiledQuery.sql,
      [...compiledQuery.parameters],
    );
    // Kysely muốn numAffectedRows là BigInt — API Server không trả về số này
    // (chỉ rows), trả BigInt(0) an toàn: Better Auth dùng nó cho update/insert
    // metadata, không phụ thuộc giá trị chính xác.
    return { numAffectedRows: BigInt(0), rows };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await this.executeQuery<O>(compiledQuery);
    for (let i = 0; i < result.rows.length; i += chunkSize) {
      yield { rows: result.rows.slice(i, i + chunkSize) };
    }
  }
}
