# Database

Database ownership lives under `database/`.

What belongs here:

- Prisma schema, migrations, and domain-organized seed files under `database/prisma`.
- Database utility scripts under `database/scripts` when they are implementation assets.

What does not belong here:

- Application business logic.
- Runtime database dumps.
- Backend repositories or service classes.

Operational commands should be exposed through root `npm run db:*` scripts and implemented under `scripts/database`.
