# Biawak-tokenradar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ajihashpangestu/Biawak-tokenradar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ajihashpangestu/Biawak-tokenradar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks pre-token protocols from a supplied snapshot by implied value. Its offline dashboard includes searchable rankings, protocol details, model assumptions, and farm research plans.

## Run it

```sh
node main.ts
```

Use Node.js 22 or newer. To rebuild the local output with the supplied snapshot:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /workspace/token-radar-01-kit/input/snapshot.json
```

Open `out/dashboard/index.html` to view the generated board. The build writes
`out/board.json`, `out/data.js`, and `out/dossier.json` alongside the dashboard.
The JSON board and dashboard data come from the same scoring model. Rebuild after
changing the model or dashboard so the generated files and dossier stay in sync.

---

<sub>Entered on [make.fun](https://make.fun/?ref=g9pqytg7&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
