# Mindapp

It's an organizer.

Intentionally text only so you can reference other media via links.

Best used with the Mindapp extension.

https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep

## How to run locally

Make sure you have:
- Git installed: https://git-scm.com/install/
- Bun installed: https://bun.sh/

In your computer's terminal:

1. `git clone <repo-url>` *Downloads Mindapp codebase to your computer*
2. `bun install` *Installs project dependencies in package.json*
3. `bun run db:push` *Sets the local database schema*
4. Accept the prompt to run the SQL commands
5. `bun run dev` *Runs Mindapp locally in dev mode*

At this point, you have a fully functional Mindapp instance that only your computer has access to. You can try tinkering with the code and make changes locally.


## Architecture

Mindapp is a SvelteKit app that uses a libSQL database.

SvelteKit: https://svelte.dev/docs/kit/introduction
libSQL: https://docs.turso.tech/libsql

It is hosted on Netlify (for the SvelteKit client/server logic) and Turso for the database
Netlify: https://www.netlify.com/pricing/
Turso: https://turso.tech/pricing

The codebase uses a single generic table called "parts" to store every row.
The parts table schema is:
```
code INTEGER NOT NULL
txt TEXT
p1 INTEGER
p2 INTEGER
p3 INTEGER
p4 INTEGER
p5 INTEGER
p6 INTEGER
p7 INTEGER
p8 INTEGER
```

The `code` column corresponds to several different part codes whose names describes how the p1-p8 columns are used. For example, parte code `0` is `postImb_parentMb_rootMb_childCount`. That means 
`postImb`: p1 = in_ms, p2 = ms, p3 = by_ms
`parentMb`: p4/p5 = parent post ms/by_ms
`rootMb`: p6/p7 = root post ms/by_ms
`childCount`: p8 = how many direct replies the post has

`in_ms`, `ms`, and `by_ms` are variable names to identify where something is, when it happened, and by who. They are all Unix timestamp in milliseconds. The timestamp when you create an account is your account id. The timestamp when you create a space is that space's id. Etc.

For the full list of part codes and how the rows are indexed, see:
`partCodes.ts`: https://github.com/mileung/new-mindapp/blob/main/src/lib/types/parts/partCodes.ts
`partsTable.ts`: https://github.com/mileung/new-mindapp/blob/main/src/lib/types/parts/partsTable.ts
`local-db.ts`: https://github.com/mileung/new-mindapp/blob/main/src/lib/local-db.ts

The Mindapp client runs a SQLite database with the same schema as the cloud db for saving posts offline.

https://repomix.com/?repo=https%3A%2F%2Fgithub.com%2Fmileung%2Fnew-mindapp