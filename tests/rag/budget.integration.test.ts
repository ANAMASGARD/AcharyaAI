import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { query } from "@/server/rag/db";
import { reserveUsage, settleUsage } from "@/server/rag/budget";
describe.skipIf(process.env.RAG_INTEGRATION !== "1")(
  "persistent spending cap",
  () => {
    const id = "budget-test-" + Date.now();
    beforeAll(async () => {
      Object.assign(process.env, parseEnv(readFileSync(".env", "utf8")));
      await query(
        "INSERT INTO acharya_rag.budgets(id,limit_usd) VALUES($1,0.2)",
        [id],
      );
    });
    afterAll(async () => {
      await query("DELETE FROM acharya_rag.provider_usage WHERE budget_id=$1", [
        id,
      ]);
      await query("DELETE FROM acharya_rag.budgets WHERE id=$1", [id]);
    });
    it("allows only one concurrent reservation and reconciles usage once", async () => {
      const body = { model: "gpt-5-mini", max_output_tokens: 24000 };
      const calls = await Promise.allSettled([
        reserveUsage(body, id),
        reserveUsage(body, id),
      ]);
      expect(calls.filter((c) => c.status === "fulfilled")).toHaveLength(1);
      expect(calls.filter((c) => c.status === "rejected")).toHaveLength(1);
      const success = calls.find(
        (c) => c.status === "fulfilled",
      ) as PromiseFulfilledResult<string>;
      await settleUsage(success.value, "gpt-5-mini", {
        input_tokens: 1000,
        output_tokens: 1000,
      });
      await settleUsage(success.value, "gpt-5-mini", {
        input_tokens: 1000,
        output_tokens: 1000,
      });
      const [b] = await query<{ committed_usd: string }>(
        "SELECT committed_usd FROM acharya_rag.budgets WHERE id=$1",
        [id],
      );
      expect(Number(b.committed_usd)).toBeCloseTo(0.00225, 8);
      await reserveUsage(body, id);
    }, 30000);
  },
);
