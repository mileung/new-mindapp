import { and, asc, desc, eq, gt, gte, isNotNull, isNull, like, lte, not } from 'drizzle-orm';
import type { AtIdObj, FullIdObj, IdObj } from './partIds';
import { pTable } from './partsTable';

let filterIdObj = (idObj: IdObj) =>
	and(
		eq(pTable.ms, idObj.ms), //
		eq(pTable.by_ms, idObj.by_ms),
		eq(pTable.in_ms, idObj.in_ms),
	);

let filterIdObjAsAtIdObj = (idObj: IdObj) =>
	and(
		eq(pTable.at_ms, idObj.ms), //
		eq(pTable.by_ms, idObj.by_ms),
		eq(pTable.at_in_ms, idObj.in_ms),
	);

let filterAtIdObjAsIdObj = (idObjAtIdObj: FullIdObj) =>
	and(
		eq(pTable.ms, idObjAtIdObj.at_ms),
		eq(pTable.by_ms, idObjAtIdObj.at_by_ms),
		eq(pTable.at_in_ms, idObjAtIdObj.at_in_ms),
	);

let filterAtIdObj = (idObjAtIdObj: AtIdObj) =>
	and(
		eq(pTable.at_ms, idObjAtIdObj.at_ms),
		eq(pTable.by_ms, idObjAtIdObj.at_by_ms),
		eq(pTable.at_in_ms, idObjAtIdObj.at_in_ms),
	);

export let pt = {
	id: filterIdObj,
	notId: (io: IdObj) => not(filterIdObj(io)!),
	notIdAsAtId: (io: IdObj) => not(filterIdObjAsAtIdObj(io)!),
	idAsAtId: filterIdObjAsAtIdObj,
	atIdAsId: filterAtIdObjAsIdObj,
	atId: filterAtIdObj,

	noParent: and(
		eq(pTable.at_ms, 0), //
		eq(pTable.at_by_ms, 0),
		eq(pTable.at_in_ms, 0),
	),
	at_ms: {
		eq: (v: number) => eq(pTable.at_ms, v),
		eq0: eq(pTable.at_ms, 0),
		notEq: (v: number) => not(eq(pTable.at_ms, v)),
		gt0: gt(pTable.at_ms, 0),
	},
	at_by_ms: {
		eq: (v: number) => eq(pTable.at_by_ms, v),
		eq0: eq(pTable.at_by_ms, 0),
		notEq: (v: number) => not(eq(pTable.at_by_ms, v)),
		gt0: gt(pTable.at_by_ms, 0),
	},
	at_in_ms: {
		eq: (v: number) => eq(pTable.at_in_ms, v),
		eq0: eq(pTable.at_in_ms, 0),
		notEq: (v: number) => not(eq(pTable.at_in_ms, v)),
		gt0: gt(pTable.at_in_ms, 0),
	},
	ms: {
		lte: (v: number) => lte(pTable.ms, v),
		asc: asc(pTable.ms),
		desc: desc(pTable.ms),
		eq: (v: number) => eq(pTable.ms, v),
		eq0: eq(pTable.ms, 0),
		notEq: (v: number) => not(eq(pTable.ms, v)),
		gte: (v: number) => gte(pTable.ms, v),
		gt0: gt(pTable.ms, 0),
	},
	by_ms: {
		eq: (v: number) => eq(pTable.by_ms, v),
		eq0: eq(pTable.by_ms, 0),
		notEq: (v: number) => not(eq(pTable.by_ms, v)),
		gt0: gt(pTable.by_ms, 0),
	},
	in_ms: {
		eq: (v: number) => eq(pTable.in_ms, v),
		eq0: eq(pTable.in_ms, 0),
		notEq: (v: number) => not(eq(pTable.in_ms, v)),
		gt0: gt(pTable.in_ms, 0),
	},
	code: {
		eq: (v: number) => eq(pTable.code, v),
	},
	txt: {
		eq: (v: string) => eq(pTable.txt, v),
		notEq: (v: string) => not(eq(pTable.txt, v)),
		like: (v: string) => like(pTable.txt, v),
		notLike: (v: string) => not(like(pTable.txt, v)),
		isNull: isNull(pTable.txt),
		isNotNull: isNotNull(pTable.txt),
	},
	num: {
		eq: (v: number) => eq(pTable.num, v),
		eq0: eq(pTable.num, 0),
		notEq: (v: number) => not(eq(pTable.num, v)),
		lte: (v: number) => lte(pTable.num, v),
		isNull: isNull(pTable.num),
		isNotNull: isNotNull(pTable.num),
	},
} as const;
