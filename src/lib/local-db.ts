import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { gs } from './global-state.svelte';
import { m } from './paraglide/messages';

// https://sqlocal.dev/guide/introduction
export async function initLocalDb() {
	let { sql } = new SQLocalDrizzle('mindapp.db');
	try {
		await sql`
			PRAGMA journal_mode=WAL;
			CREATE TABLE IF NOT EXISTS parts (
				to_ms INTEGER,
				to_by_ms INTEGER,
				to_in_ms INTEGER,
				ms INTEGER,
				by_ms INTEGER,
				in_ms INTEGER,
				code INTEGER,
				txt TEXT,
				num REAL
			);
			CREATE INDEX IF NOT EXISTS to_ms_idx ON parts (to_ms);
			CREATE INDEX IF NOT EXISTS to_by_ms_idx ON parts (to_by_ms);
			CREATE INDEX IF NOT EXISTS to_in_ms_idx ON parts (to_in_ms);
			CREATE INDEX IF NOT EXISTS ms_idx ON parts (ms);
			CREATE INDEX IF NOT EXISTS by_ms_idx ON parts (by_ms);
			CREATE INDEX IF NOT EXISTS in_ms_idx ON parts (in_ms);
			CREATE INDEX IF NOT EXISTS code_idx ON parts (code);
			CREATE INDEX IF NOT EXISTS txt_idx ON parts (txt);
			CREATE INDEX IF NOT EXISTS num_idx ON parts (num);
	`;
	} catch (error) {
		console.log('error:', error);
	}
}

export async function gsdb() {
	let attempts = 0;
	while (!gs.db) {
		if (++attempts > 888) {
			alert(m.localDatabaseTimedOut());
			throw new Error(m.localDatabaseTimedOut());
		}
		await new Promise((res) => setTimeout(res, 42));
	}
	return gs.db;
}
