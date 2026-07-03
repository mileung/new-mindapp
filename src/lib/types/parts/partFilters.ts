import { asc, desc, eq, gt, gte, isNotNull, isNull, like, lt, lte, not, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { pTable } from './partsTable';

let makeIntegerFilterObj = (col: SQLiteColumn) => ({
	asc: asc(col),
	desc: desc(col),
	eq: (v: number) => eq(col, v),
	eq0: eq(col, 0),
	notEq: (v: number) => not(eq(col, v)),
	gt: (v: number) => gt(col, v),
	gte: (v: number) => gte(col, v),
	gt0: gt(col, 0),
	gte0: gte(col, 0),
	lt: (v: number) => lt(col, v),
	lte: (v: number) => lte(col, v),
	lt0: lt(col, 0),
	lte0: lte(col, 0),
	isNull: isNull(pTable.txt),
	isNotNull: isNotNull(pTable.txt),
});

export let pf = {
	code: { eq: (v: number) => eq(pTable.code, v) },
	p1: makeIntegerFilterObj(pTable.p1),
	p2: makeIntegerFilterObj(pTable.p2),
	p3: makeIntegerFilterObj(pTable.p3),
	p4: makeIntegerFilterObj(pTable.p4),
	p5: makeIntegerFilterObj(pTable.p5),
	p6: makeIntegerFilterObj(pTable.p6),
	p7: makeIntegerFilterObj(pTable.p7),
	p8: makeIntegerFilterObj(pTable.p8),
	txt: {
		eq: (v: string) => eq(pTable.txt, v),
		notEq: (v: string) => not(eq(pTable.txt, v)),
		like: (v: string) => like(pTable.txt, v),
		notLike: (v: string) => not(like(pTable.txt, v)),
		likeEscaped: (v: string) => sql`${pTable.txt} LIKE ${v} ESCAPE '\\'`,
	},
} as const;
