# South Carolina 2026 Tax Changes dashboard

Models the impact of South Carolina's H.4216 / Act 110 (rate-table flattening,
SCAID repeal, and EITC cap) on households, statewide revenue, and the state's
seven congressional districts.

- **Frontend**: `frontend/` (Next.js / Tailwind)
- **Modal pipelines**: `scripts/modal_pipeline.py` (statewide), `scripts/modal_district_pipeline.py` (per-district)
- **Pre-computed CSVs**: `frontend/public/data/*.csv`

Live: <https://policyengine-south-carolina-2026-tax-changes.vercel.app/us/south-carolina-2026-tax-changes>
