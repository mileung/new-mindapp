import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	not,
	or,
} from 'drizzle-orm';
import type { GranularNumProp, GranularTxtProp } from '.';
import type { AtIdObj, FullIdObj, IdObj } from './partIds';
import { pTable } from './partsTable';

let filterIdObj = (idObj: Partial<IdObj>) =>
	and(
		eq(pTable.ms, idObj.ms || 0),
		eq(pTable.by_ms, idObj.by_ms || 0),
		eq(pTable.in_ms, idObj.in_ms || 0),
	);

let filterIdObjAsAtIdObj = (idObj: Partial<IdObj>) =>
	and(
		eq(pTable.at_ms, idObj.ms || 0),
		eq(pTable.at_by_ms, idObj.by_ms || 0),
		eq(pTable.at_in_ms, idObj.in_ms || 0),
	);

let filterAtIdObjAsIdObj = (idObjAtIdObj: Partial<FullIdObj>) =>
	and(
		eq(pTable.ms, idObjAtIdObj.at_ms || 0),
		eq(pTable.by_ms, idObjAtIdObj.at_by_ms || 0),
		eq(pTable.in_ms, idObjAtIdObj.at_in_ms || 0),
	);

let filterAtIdObj = (idObjAtIdObj: Partial<AtIdObj>) =>
	and(
		eq(pTable.at_ms, idObjAtIdObj.at_ms || 0),
		eq(pTable.at_by_ms, idObjAtIdObj.at_by_ms || 0),
		eq(pTable.at_in_ms, idObjAtIdObj.at_in_ms || 0),
	);

export let pf = {
	id: filterIdObj,
	idAsAtId: filterIdObjAsAtIdObj,
	atIdAsId: filterAtIdObjAsIdObj,
	atId: filterAtIdObj,
	notId: (io: Partial<IdObj>) => not(filterIdObj(io)!),
	notAtId: (aio: Partial<AtIdObj>) => not(filterAtIdObj(aio)!),
	notIdAsAtId: (io: Partial<IdObj>) => not(filterIdObjAsAtIdObj(io)!),
	notGranularTxt: (gn: GranularTxtProp) =>
		or(
			pf.ms.notEq(gn.ms || 0),
			pf.txt.notEq(gn.txt), //
		),
	notGranularNum: (gn: GranularNumProp) =>
		or(
			pf.ms.notEq(gn.ms || 0),
			pf.num.notEq(gn.num), //
		),

	noAtId: and(
		eq(pTable.at_ms, 0), //
		eq(pTable.at_by_ms, 0),
		eq(pTable.at_in_ms, 0),
	),
	at_ms: {
		eq: (v: number) => eq(pTable.at_ms, v),
		eq0: eq(pTable.at_ms, 0),
		notEq: (v: number) => not(eq(pTable.at_ms, v)),
		gt0: gt(pTable.at_ms, 0),
		gt: (v: number) => gt(pTable.at_ms, v),
		lt: (v: number) => lt(pTable.at_ms, v),
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
		asc: asc(pTable.ms),
		desc: desc(pTable.ms),
		eq: (v: number) => eq(pTable.ms, v),
		eq0: eq(pTable.ms, 0),
		notEq: (v: number) => not(eq(pTable.ms, v)),
		gt: (v: number) => gt(pTable.ms, v),
		gt0: gt(pTable.ms, 0),
		lt: (v: number) => lt(pTable.ms, v),
	},
	by_ms: {
		eq: (v: number) => eq(pTable.by_ms, v),
		eq0: eq(pTable.by_ms, 0),
		notEq: (v: number) => not(eq(pTable.by_ms, v)),
		gt0: gt(pTable.by_ms, 0),
		lt: (v: number) => lt(pTable.by_ms, v),
	},
	in_ms: {
		eq: (v: number) => eq(pTable.in_ms, v),
		eq0: eq(pTable.in_ms, 0),
		notEq: (v: number) => not(eq(pTable.in_ms, v)),
		gt0: gt(pTable.in_ms, 0),
		lt: (v: number) => lt(pTable.in_ms, v),
	},
	code: {
		eq: (v: number) => eq(pTable.code, v),
	},
	num: {
		desc: desc(pTable.num),
		eq: (v: number) => eq(pTable.num, v),
		eq0: eq(pTable.num, 0),
		notEq: (v: number) => not(eq(pTable.num, v)),
		gt0: gt(pTable.num, 0),
		gte0: gte(pTable.num, 0),
		lt: (v: number) => lt(pTable.num, v),
		lte: (v: number) => lte(pTable.num, v),
		isNull: isNull(pTable.num),
	},
	txt: {
		asc: asc(pTable.txt),
		eq: (v: string) => eq(pTable.txt, v),
		notEq: (v: string) => not(eq(pTable.txt, v)),
		like: (v: string) => like(pTable.txt, v),
		notLike: (v: string) => not(like(pTable.txt, v)),
		isNull: isNull(pTable.txt),
		isNotNull: isNotNull(pTable.txt),
	},
} as const;
