// Shared postflight settlement for every paid audio launcher. Pure apart from
// the injected reads: the debit is always max(estimate, observed deltas, header).
export function accountCost(delta, estimated, header = null) {
  const flags = [];
  if (delta === null) flags.push('balance_unavailable');
  else if (delta < 0) flags.push('negative_balance_delta');
  else if (delta > estimated * 2) flags.push('shared_delta_implausibly_large');
  if (delta === 0) flags.push('balance_may_lag');
  return { chargedCredits: Math.max(delta ?? 0, estimated, header ?? 0), flags };
}
export function measuredDelta(before, after) {
  if (!after) return null;
  // If the billing period changes, old-period final usage is unknowable. The
  // full reservation remains charged; new-period usage is a conservative proxy.
  return before.resetsAt === after.resetsAt ? Math.max(0, before.remaining - after.remaining) : Math.max(0, after.used);
}
const plainDelta = (before, after) => after ? before.remaining - after.remaining : null;
// Up to `attempts` waited reads while the immediate counter may still lag.
// Stops early once a read reflects the estimate or the STOP latch appears.
export async function settlementReads({ before, estimate, waitMs, sleep, read, stopped, resetAware = false, attempts = 3 }) {
  const delta = resetAware ? measuredDelta : plainDelta, reads = [];
  for (let attempt = 0; attempt < attempts && !stopped(); attempt++) {
    await sleep(waitMs);
    let s;
    try { s = await read(); } catch { return { reads, failed: true }; }
    reads.push(s);
    if (delta(before, s) >= estimate) break;
  }
  return { reads, failed: false };
}
// Either pass before/after/settlementReads (deltas derived here) or the
// already observed immediateDelta/settledDeltas. resetAware is the AU3 rule.
export function settle({ estimate, header = null, before, after, settlementReads: reads = [], immediateDelta, settledDeltas, resetAware = false }) {
  const delta = resetAware ? measuredDelta : plainDelta;
  const accountDelta = before ? delta(before, after) : immediateDelta ?? null;
  const settled = before ? reads.map(s => delta(before, s)) : settledDeltas ?? [];
  const settledDelta = settled.length ? Math.max(...settled) : null;
  if (!resetAware) {
    const observed = settledDelta != null ? Math.max(accountDelta ?? settledDelta, settledDelta) : accountDelta;
    const { chargedCredits, flags } = accountCost(observed, estimate, header);
    if (accountDelta === 0 && settledDelta > 0) flags.push('charge_visible_only_after_settlement_wait');
    return { accountDelta, settledDelta, chargedCredits, flags };
  }
  const flags = [];
  if ([after, ...reads].some(s => s && s.resetsAt !== before.resetsAt)) flags.push('account_reset_during_call_estimate_retained');
  if (!after) flags.push('balance_unavailable');
  if (accountDelta === 0 && settledDelta > 0) flags.push('charge_visible_after_settlement');
  return { accountDelta, settledDelta, chargedCredits: Math.max(estimate, accountDelta ?? 0, settledDelta ?? 0, header ?? 0), flags };
}
