import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { gs } from './global-state.svelte';
import { m } from './paraglide/messages';

// https://sqlocal.dev/guide/introduction
export async function initLocalDb() {
	let { sql } = new SQLocalDrizzle('mindapp.db');
	try {
		await sql`
			PRAGMA journal_mode=WAL;
			CREATE TABLE IF NOT EXISTS thoughts (
				ms INTEGER,
				tags TEXT,
				body TEXT,
				by_ms INTEGER,
				to_id TEXT,
				in_ms INTEGER,
				CONSTRAINT thought_id PRIMARY KEY (ms, by_ms, in_ms)
			);
			CREATE INDEX IF NOT EXISTS ms_idx ON thoughts (ms);
			CREATE INDEX IF NOT EXISTS tags_idx ON thoughts (tags);
			CREATE INDEX IF NOT EXISTS body_idx ON thoughts (body);
			CREATE INDEX IF NOT EXISTS by_ms_idx ON thoughts (by_ms);
			CREATE INDEX IF NOT EXISTS to_id_idx ON thoughts (to_id);
			CREATE INDEX IF NOT EXISTS in_ms_idx ON thoughts (in_ms);
	`;
	} catch (error) {
		console.log('error:', error);
	}
}

export async function gsdb() {
	let attempts = 0;
	while (!gs.db) {
		if (++attempts > 88) {
			alert(m.localDatabaseTimedOut());
			throw new Error(m.localDatabaseTimedOut());
		}
		await new Promise((res) => setTimeout(res, 100));
	}
	return gs.db;
}
