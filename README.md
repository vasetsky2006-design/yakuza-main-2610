# YAKUZA AI Control Tower

Canonical source: `vasetsky2006-design/yakuza-main-2610`, branch `main`.
Production: https://yakuza.pp.ua / Netlify project `yakuza-prodavai`.
The `yakuzasalesbot-cpu/yakuza-main-2610` fork is for pull requests only, not an additional deployment source.

| URL | Purpose |
| --- | --- |
| `/` | YAKUZA AI Control Tower overview |
| `/sales` | Existing consulting, offers, cases and lead form |
| `/sales-bot` | Telegram sales training entry |
| `/roadmap` | Directional vision 2026–2036 |

## Build

Public files live in `site/`; functions live in `netlify/functions/`.
Run `npm test` before release. Netlify runs `npm run build` and publishes only `site/`.
No dependencies, credentials or real lead submissions are required for tests.
All Netlify paths must remain relative to the repository.

## Recovery, 27 October 2026

Production showed the Sales Bot homepage (deploy `6ae0410d346cc970fd9d58c1`, label `9683022`), while the connected repository contained the consulting site. Three later deployments of `3177800` failed because the imported Netlify configuration referenced a local Mac path. The import also omitted the lead-intake function.

Existing public files are preserved under `site/`; the consulting homepage moves to `/sales`. The new homepage follows the owner's choice of AI Control Tower as the main identity. Planned modules are explicitly labelled as roadmap items. KATANA owns social/content workflows; Torii owns integrations; Shogun owns orchestration and permissions; Sakura provides the management overview.

## Operational limits

Lead delivery remains fail-closed unless `LEAD_ENDPOINT_ENABLED=true` and `LEGAL_GATE_APPROVED=true` are configured. Restoring code does not certify legal readiness or prove end-to-end delivery. Keep `LEAD_SINK_URL`, `LEAD_SINK_TOKEN` and origin settings in Netlify environment variables. Never commit their values.

Existing legal documents still require review of their placeholders and provider details. This release does not activate payments, certify tax registration, or change legal approval flags. The homepage contact route uses the existing Zoom calendar.

## Release

Merge the reviewed pull request into the canonical repository. Verify the matching Netlify deploy is ready, then check `/`, `/sales`, `/sales-bot`, `/roadmap` and the GET contract of `/.netlify/functions/lead-intake`. Do not deploy an old ZIP or the `prodavai` project over this site.
