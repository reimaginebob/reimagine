# Database migrations

Each `.sql` file in this folder is a one-way schema change. The runner at
`scripts/migrate.mjs` applies them in alphabetical filename order and records
each in the `schema_migrations` table.

The runner uses the `Pool` export from `@neondatabase/serverless`, which
connects to Neon over a WebSocket. Point `DATABASE_URL` at a Neon database
(production or a Neon branch). It does **not** speak the raw Postgres wire
protocol to an arbitrary local server, so test against a Neon branch rather
than a bare local Postgres.

## Adding a new migration

1. Create a new file named `YYYY-MM-DD_kebab-description.sql` (use today's
   date). The runner picks files up by name; alphabetical order is the
   apply order. (`001_init.sql` keeps its legacy prefix and sorts first.)
2. Write the change as a single SQL block. The runner wraps the whole file
   in a `BEGIN`/`COMMIT`, so partial failures roll back cleanly. Avoid
   statements that cannot run inside a transaction (e.g. `CREATE INDEX
   CONCURRENTLY`).
3. Run `npm run migrate:status` against a Neon branch to confirm the new file
   appears as pending.
4. Run `npm run migrate` against a Neon branch database to verify the SQL
   works. Never run `npm run migrate` against production from a workstation;
   production migrations are applied via the documented maintainer procedure
   below.

## Bootstrapping an existing database

The `schema_migrations` table did not exist before this system shipped.
On the first deploy that includes the runner, the production database
already has every current migration applied. Run this once to register
them as applied without re-executing them:

```
DATABASE_URL=<production_connection_string> npm run migrate:bootstrap
```

After that, all future migrations land via `npm run migrate`.

## Running against production

Production migrations are applied from a maintainer's machine with the
production `DATABASE_URL` exported in the shell environment for a single
command. Do not commit the URL anywhere. Do not wire `migrate` into the
Vercel deploy pipeline; that change has not been agreed to.
