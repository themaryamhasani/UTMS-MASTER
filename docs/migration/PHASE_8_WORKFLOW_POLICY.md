# Phase 8 Workflow Policy Notes

> Historical delivery record. Workflow-policy reads and assignment updates are now PostgreSQL-backed in backend mode; see [Current Implementation](../architecture/CURRENT_IMPLEMENTATION.md).

This document records the frontend/mock boundary for modular VersionHistory authority.

## Implemented Mock Behavior

- Each Application has a `workflowPolicyId`.
- `standard-tech-lead` keeps the current approved model:
  - QA Lead records QA quality.
  - Tech Lead makes final publish/version decisions.
  - Tech Lead accepts emergency risk.
- `qa-owned-release` supports projects where QA Lead owns both:
  - QA quality review.
  - Final publish/version decision.
  - Emergency risk acceptance.
- VersionHistory UI now uses capability checks:
  - `versionHistory:create`
  - `versionHistory:qaReview`
  - `versionHistory:decide`
  - `versionHistory:riskAccept`
  - `versionHistory:comment`
  - `versionHistory:view`
- The Settings page lets System Admin switch a mock Application policy.
- When System Admin switches an Application to `qa-owned-release`, active contexts are refreshed and QA Lead can immediately use `versionHistory:decide` for pending VersionHistory records in that Application.
- The mock API accepts the active role for VersionHistory commands and validates it against the Application policy.

## Backend Boundary

Production should persist WorkflowPolicy records and Application policy assignment.

Recommended backend rules:

- Never infer publish authority from a hard-coded role.
- Resolve policy by Application before every VersionHistory command.
- Enforce capabilities server-side using active context role and scope.
- Include policy id/version in audit metadata for publish decisions.
- Keep the UI labels policy-driven so future projects can change authority without a frontend rewrite.

## Current Mock Policies

| Policy | QA Review | Final Decision | Independent Decision Role |
|---|---|---|---|
| `standard-tech-lead` | QA Lead | Tech Lead | Yes |
| `qa-owned-release` | QA Lead | QA Lead | No |
