// Standard GPT-5 mini rates verified 2026-09-18 against official model/pricing docs.
// Keep the full reservation for missing, failed, ambiguous, or unfinished responses.
export function accountedCost(reserved: number, responses: any[]): number {
  if (responses.length !== 3 || new Set(responses.map(r => r.detail?.responseId)).size !== 3) return reserved;
  let cost = 0;
  for (const r of responses) {
    const d = r.detail, u = d?.usage;
    if (r.status !== "completed" || d.model !== "gpt-5-mini" || !u ||
        !Number.isFinite(u.input_tokens) || u.input_tokens < 0 ||
        !Number.isFinite(u.output_tokens) || u.output_tokens < 0 || !Array.isArray(d.output)) return reserved;
    // Charge cached inputs at the higher uncached rate; double the estimate as headroom.
    cost += u.input_tokens * 0.25 / 1e6 + u.output_tokens * 2 / 1e6 + d.output.filter((o:any)=>o.type === "web_search_call").length * 0.01;
  }
  return Math.max(0.01, Math.ceil(cost * 2 * 100) / 100);
}
