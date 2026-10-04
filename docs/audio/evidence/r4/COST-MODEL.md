# AU3 measured full-track cost — 2026-10-04

Two requests, each one six-section 150 s music_v1 composition: **4,500 credits each**, **9,000 total**, **30 credits/requested second** (1,800/minute). Each call's immediate and settled shared balance deltas were exactly 4,500. The decoded sources are each 150.047347 s: observed shared delta / decoded second is approximately 29.99053. There is no per-track billing header, so these remain shared-account observations, not exclusive invoice attribution.

Opening live balance 10,689; final observed 1,689. Job cap 10,000; unused 1,000. Account floor 1,000; final observed headroom 689. Debit is max(30/s estimate, immediate and settled shared delta, any valid header). Every paid call had a fresh subscription read immediately before it, separated only by required pacing. 9 AU3 HTTP requests, two paid POSTs, all HTTP 200; minimum response-completion-to-next-request gap 8.004 s. No quota/rate error, reset, paid retry or unresolved reservation. The shared garden-vr account cannot be locked atomically by this project.

One 150 s Hide and iron take would require 4,500; its 90 s fallback 2,700. Both exceed both remaining allowances. A reset increases account funds but never renews the job cap. Paid generation is closed. All mastering, section cuts, loop and sting edits cost zero extra provider credits.

At this measured rate, the three-track first-take plan is 13,500 credits / 450 requested seconds; 50% rework allowance 20,250. Cost per accepted minute is unknown until owner listening. Both sources provide long files and decaying tails; that is not evidence of exact melodic continuity, six perceptually convincing phases or seamless adaptive use. Do not upgrade on duration alone. Review these takes, then compare long-form/camp editing with Google under a separate authorization; Google quality and credit equivalence are untested here.

Evidence: paid ledger and equal raw sidecars; cost-audit.json; derivative sidecars and loudnorm logs. Archived API contract: compose-api-2026-10-04.md, fetched from https://elevenlabs.io/docs/api-reference/music/compose.md. The old 8,000 reserve and 13,000 floor were superseded only for this D39 job.
