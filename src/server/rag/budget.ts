import { nanoid } from "nanoid";
import { query, sqlClient } from "./db";
import { RagError } from "./contracts";
import { tokenCount } from "./tokens";
// Official model pricing checked 2026-10-31. USD / million tokens, standard API.
// https://developers.openai.com/api/docs/models/gpt-5-mini
// https://developers.openai.com/api/docs/models/text-embedding-3-small
export const PRICING_VERSION = "openai-standard-2026-10-31";
const budgetId = "curriculum-preload-v1";
export function cost(model: string, input: number, output = 0): number {
  if (model === "text-embedding-3-small") return (input * 0.02) / 1e6;
  if (model === "gpt-5-mini") return (input * 0.25 + output * 2) / 1e6;
  throw new RagError("This model has no verified spending configuration.", 503);
}
export async function reserveUsage(
  body: Record<string, unknown>,
  selectedBudget = budgetId,
): Promise<string> {
  const model = String(body.model);
  const output = Number(body.max_output_tokens ?? 0);
  // For image/PDF calls reserve the entire model context, not a guessed image-token count.
  const input =
    model === "text-embedding-3-small"
      ? (body.input as string[]).reduce((n, t) => n + tokenCount(t), 0)
      : 400000;
  const reserved = Math.ceil(cost(model, input, output) * 1e8) / 1e8;
  const id = nanoid();
  const rows = await query<{ id: string }>(
    `WITH reserved AS (
 UPDATE acharya_rag.budgets SET committed_usd=committed_usd+$2 WHERE id=$1 AND committed_usd+$2<=limit_usd RETURNING id
 ) INSERT INTO acharya_rag.provider_usage(id,budget_id,model,reserved_usd,pricing_version)
 SELECT $3,id,$4,$2,$5 FROM reserved RETURNING id`,
    [selectedBudget, reserved, id, model, PRICING_VERSION],
  );
  if (!rows.length)
    throw new RagError(
      "The $10 processing budget cannot cover the next request. Progress is saved; increase the server budget deliberately before resuming.",
      402,
    );
  return id;
}
export async function settleUsage(
  id: string,
  model: string,
  usage: unknown,
): Promise<void> {
  if (!usage || typeof usage !== "object") return; // Missing usage/network ambiguity retains the full reservation.
  const u = usage as Record<string, unknown>;
  const input = Number(u.input_tokens ?? u.prompt_tokens),
    output = Number(u.output_tokens ?? 0);
  if (
    !Number.isInteger(input) ||
    input < 0 ||
    !Number.isInteger(output) ||
    output < 0
  )
    return;
  const actual = cost(model, input, output);
  const sql = sqlClient();
  await sql.transaction([
    sql.query(
      `WITH settled AS (UPDATE acharya_rag.provider_usage SET actual_usd=$2,input_tokens=$3,output_tokens=$4,status='settled' WHERE id=$1 AND status='reserved' RETURNING budget_id,reserved_usd)
   UPDATE acharya_rag.budgets b SET committed_usd=committed_usd-(s.reserved_usd-$2) FROM settled s WHERE b.id=s.budget_id`,
      [id, actual, input, output],
    ),
  ]);
}
export async function usageSummary(): Promise<unknown> {
  return query(
    `SELECT b.limit_usd,b.committed_usd,COALESCE(sum(p.actual_usd),0) measured_usd,count(p.id)::int calls,count(p.id) FILTER(WHERE p.status='reserved')::int ambiguous_calls FROM acharya_rag.budgets b LEFT JOIN acharya_rag.provider_usage p ON p.budget_id=b.id WHERE b.id=$1 GROUP BY b.id`,
    [budgetId],
  );
}
