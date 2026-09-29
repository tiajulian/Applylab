// Test-only Supabase stand-in: records every query-builder call and answers each table (or rpc)
// from a queue of results, so route tests can assert what was queried and for which user.

type Result = { data?: unknown; error?: unknown };

export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

export function fakeSupabase(results: Record<string, Result[]> = {}) {
  const calls: RecordedCall[] = [];
  const next = (key: string): Result => results[key]?.shift() ?? { data: null, error: null };

  const builder = (table: string) => {
    const node: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "not", "gte", "lt", "order", "limit", "delete", "update", "insert", "upsert"]) {
      node[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return node;
      };
    }
    const settle = () => Promise.resolve(next(table));
    node.maybeSingle = settle;
    node.single = settle;
    node.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => settle().then(resolve, reject);
    return node;
  };

  return {
    calls,
    /** Every value passed to .eq(column, value) for a table, e.g. all user_id filters. */
    eqValues: (table: string, column: string) =>
      calls.filter((c) => c.table === table && c.method === "eq" && c.args[0] === column).map((c) => c.args[1]),
    client: {
      from: builder,
      rpc: (fn: string, args: unknown) => {
        calls.push({ table: `rpc:${fn}`, method: "rpc", args: [args] });
        return Promise.resolve(next(`rpc:${fn}`));
      },
    },
  };
}
