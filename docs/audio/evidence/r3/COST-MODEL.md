# AU2b cost and pacing evidence

Opening shared balance 18,109; final 16,089 at 2026-10-03T11:35:16.636Z. The 364-credit decline since AU2 closed happened outside this round and is not charged again. Shared drop this round 2,020, conservative debit **2,325/3,000**, unused 675. AU1 1,852 and AU2 4,995 remain separate histories; cumulative debit 9,172. No production, Google or paid capability probes.

Eleven SFX requests total 22 seconds, with exact provider headers totaling 220 credits: 10/s. The guard retained 20/s. Two 30 s music requests reserve 900 each; immediate/settlement snapshots remain in [music-balance-pairs.json](music-balance-pairs.json). Reed standard's interval includes 925 credits; Lyre vow 900. The extra 25 is consistent with delayed preceding SFX but cannot be exclusively attributed, so the higher debit remains. Collar's shared delta 70 also exceeds its 20 estimate and 10 header; it remains charged at 70. Max-accounting intentionally overstates attributable billing rather than treating stale counters as free.

At 30/s music plus exact SFX headers, the whole-round working charge is 2,020; it matches the observed account drop. That agreement supports the model but does not exclude coincident garden-vr spending. Compare the 2,325 conservative cap debit, which is deliberately larger. No billing counter was lowered to make the budget fit.

43 HTTP requests, all 200, 0 rate limits, minimum completion-to-next-start gap 8.001 s. All API commands share the lock and persisted pacing. Music settlement waits 30 s between reads, no automatic paid retries. Minimum observed balance 16,089, above the 13,000 floor and 8,000 reserve. A separate process cannot be stopped atomically by this local guard.

Generation is closed-owner-review; no pending reservation. Round-2 final budget/state/pacing and the original proof were archived before opening AU2b. The 90,000 account limit is not a promised reset allocation; confirm the actual balance after 2026-10-04 19:31:41 UTC before setting a new production budget.
