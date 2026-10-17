# AU5 measured cost: Hide and iron on music_v2_5 (2026-10-17)

Two paid requests, both HTTP 200, no retry:

| Step | Requested seconds | Observed shared delta | Per second | Ledger debit (conservative) |
|---|---|---|---|---|
| Reference upload (`/v1/music/upload`, the kept r1 audition) | 20.062 | 276 | 13.76 | 602 |
| Compose (`/v1/music`, six chunks, 150 s) | 150 | 2062 | 13.75 | 4500 |

Observed total **2,338** credits; conservative ledger total **5,102** of the 6,000 job cap (30 credits/requested second, the AU3 bound, kept as the reservation rule). The compose charge appeared only in the settlement reads (immediate delta 0). Shared-account deltas, not exclusive invoice attribution.

On this Creator account, music_v2_5 observed about 13.7 credits/s against music_v1's 30/s on the AU3 Starter account. The public API price is one per-minute rate for all music models (https://elevenlabs.io/pricing/api, 2026-10-17). The upload is billed like a generation of its length, as documented.

13 AU5 HTTP requests; minimum completion-to-next-request gap 8.003 s. Opening balance 139,703; last observed 137,365.
