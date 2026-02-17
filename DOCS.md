# Documentation Hub

This repository now uses a small canonical set of documents for easier maintenance.

## Canonical Docs (Maintain These)
1. `README.md`
Purpose: project overview, setup, and quick navigation.

2. `CHANGELOG.md`
Purpose: release-by-release change history.

3. `PRODUCT_MANUAL.md`
Purpose: user workflows (doctor, pharmacist, admin), operational usage.

4. `ENGINEERING_MANUAL.md`
Purpose: architecture, environment setup, deployment, and operational technical guidance.

5. `TESTING_GUIDE.md`
Purpose: test commands, test strategy, and QA expectations.

## Maintenance Rules
- Add new product behavior details to `PRODUCT_MANUAL.md`.
- Add implementation and infra/process details to `ENGINEERING_MANUAL.md`.
- Add release notes only to `CHANGELOG.md`.
- Keep `README.md` short and link outward.
- Treat legacy docs as reference snapshots unless actively migrated.

## Legacy Docs
Legacy files are stored under `docs/legacy/` for historical context.  
If a legacy file conflicts with canonical docs, canonical docs are source of truth.
