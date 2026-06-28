import { type LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { gs } from './global-state.svelte';
import { alertError } from './js';

export type Database = LibSQLDatabase<any> | SqliteRemoteDatabase;

export let localDbFilename = 'mindapp.db';

// https://sqlocal.dev/guide/introduction
export let initLocalDb = async () => {
	return new Promise<SQLocalDrizzle>((resolve, reject) => {
		try {
			let db = new SQLocalDrizzle({
				databasePath: localDbFilename,
				onConnect: () => {
					gs.db = drizzle(db.driver, db.batchDriver);
					resolve(db);
				},
				onInit: (sql) => [
					sql`
						PRAGMA journal_mode=WAL;
						CREATE TABLE IF NOT EXISTS parts (code INTEGER NOT NULL, txt TEXT, p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER, p6 INTEGER, p7 INTEGER, p8 INTEGER);
						CREATE INDEX IF NOT EXISTS idx_code ON parts(code) WHERE code IN (29);
						CREATE INDEX IF NOT EXISTS idx_code_p1 ON parts(code, p1) WHERE code IN (8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 28);
						CREATE INDEX IF NOT EXISTS idx_code_p1_p2 ON parts(code, p1, p2) WHERE code IN (14, 24, 25, 26, 27);
						CREATE INDEX IF NOT EXISTS idx_code_p1_p3_p2 ON parts(code, p1, p3, p2) WHERE code IN (0);
						CREATE INDEX IF NOT EXISTS idx_code_p1_p3_p4 ON parts(code, p1, p3, p4) WHERE code IN (13, 26, 27);
						CREATE INDEX IF NOT EXISTS idx_code_p1_p4_p5_p6 ON parts(code, p1, p4, p5, p6) WHERE code IN (1, 3, 4);
						CREATE INDEX IF NOT EXISTS idx_code_p1_p5_p2 ON parts(code, p1, p5, p2) WHERE code IN (0);
						CREATE INDEX IF NOT EXISTS idx_code_p1_p6_p7 ON parts(code, p1, p6, p7) WHERE code IN (0);
						CREATE INDEX IF NOT EXISTS idx_code_p1_to_p3 ON parts(code, p1, p2, p3) WHERE code IN (0, 1, 2, 3, 6);
						CREATE INDEX IF NOT EXISTS idx_code_p1_to_p4 ON parts(code, p1, p2, p3, p4) WHERE code IN (5, 7);
						CREATE INDEX IF NOT EXISTS idx_code_p1_txt ON parts(code, p1, txt) WHERE code IN (3);
						CREATE INDEX IF NOT EXISTS idx_code_p2 ON parts(code, p2) WHERE code IN (21, 22);
						CREATE INDEX IF NOT EXISTS idx_code_p3 ON parts(code, p3) WHERE code IN (14);
						CREATE INDEX IF NOT EXISTS idx_code_txt ON parts(code, txt) WHERE code IN (19);
					`,
				],
			});
		} catch (error) {
			alertError(error);
			reject(error);
		}
	});
};
