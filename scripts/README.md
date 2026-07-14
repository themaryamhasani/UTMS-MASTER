# Scripts

Permanent scripts live under `scripts/` and must work from the repository root.

What belongs here:

- Development orchestration.
- Database operations.
- Migration utilities.
- Verification and CI checks.

What does not belong here:

- Application source code.
- One-off temporary scripts.
- Scripts that print secrets.

Scripts should validate inputs, return non-zero on failure, and keep output concise.
