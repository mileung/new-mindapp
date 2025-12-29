import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { gs } from './global-state.svelte';
import { m } from './paraglide/messages';

export type Database = LibSQLDatabase<any> | SqliteRemoteDatabase;

export let localDbFilename = 'mindapp.db';

// https://sqlocal.dev/guide/introduction
export let initLocalDb = async () => {
	let { sql } = new SQLocalDrizzle(localDbFilename);
	try {
		await sql`
			PRAGMA journal_mode=WAL;

			CREATE TABLE IF NOT EXISTS parts (
				at_ms INTEGER NOT NULL,
				at_by_ms INTEGER NOT NULL,
				at_in_ms INTEGER NOT NULL,
				ms INTEGER NOT NULL,
				by_ms INTEGER NOT NULL,
				in_ms INTEGER NOT NULL,
				code INTEGER NOT NULL,
				num REAL,
				txt TEXT,
				PRIMARY KEY (at_ms, at_by_ms, at_in_ms, ms, by_ms, in_ms, code, num)
			);

			CREATE INDEX IF NOT EXISTS txt_idx ON parts(txt);
	`;
	} catch (error) {
		console.error(error);
	}
};

export let gsdb = async () => {
	let attempts = 0;
	while (!gs.db) {
		if (++attempts > 888) {
			alert(m.localDatabaseTimedOut());
			throw new Error(m.localDatabaseTimedOut());
		}
		await new Promise((res) => setTimeout(res, 42));
	}
	return gs.db;
};
