import { dev } from '$app/environment';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, eq, gte, isNotNull, isNull, like, lte, not, or, SQL } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { z } from 'zod';
import { gsdb } from '../local-db';
import { partsTable } from './parts-table';

export type PartInsert = typeof partsTable.$inferInsert;
export type PartSelect = typeof partsTable.$inferSelect;

export let PartInsertSchema = createInsertSchema(partsTable);
export let PartSelectSchema = createSelectSchema(partsTable);

export let bracketRegex = /\[([^\[\]]+)]/g;
export let templateIdRegex = /^(l|\d*)_(l|\d*)_(l|\d*)$/;
export let idRegex = /^\d*_\d*_\d*$/;
export let idsRegex = /(?<!\S)(\d*_\d*_\d*)(?!\S)/g;

export let isTemplateId = (str = '') => templateIdRegex.test(str);

export let isId = (str = '') => idRegex.test(str);

export let getId = (part: PartInsert) => `${part.ms ?? ''}_${part.by_ms ?? ''}_${part.in_ms ?? ''}`;

export let getToId = (part: PartInsert) => {
	if (
		(part.to_ms !== null && part.to_ms !== undefined) ||
		(part.to_by_ms !== null && part.to_by_ms !== undefined) ||
		(part.to_in_ms !== null && part.to_in_ms !== undefined)
	)
		return `${part.to_ms ?? ''}_${part.to_by_ms ?? ''}_${part.to_in_ms ?? ''}`;
};

type UniqueValues<T extends Record<string, number>> = {
	[K in keyof T]: T[K] extends T[Exclude<keyof T, K>] ? never : T[K];
};
let uniqueMapVals = <const T extends Record<string, number>>(dict: UniqueValues<T>): T => {
	return dict;
};
export let partCodes = uniqueMapVals({
	postIdWithNumAsLastVersionToParentPostId: 0,
	postIdWithNumAsDepthToRootPostId: 1,
	postIdToCitedPostId: 2,

	currentPostTagIdWithNumAsVersionToPostId: 10,
	exPostTagIdWithNumAsVersionToPostId: 11,

	currentPostTxtAsBodyWithNumAsVersionToPostId: 20,
	exPostTxtAsBodyWithNumAsVersionToPostId: 21,

	txtAsTagAndNumAsCount: 30,
	msWithNumAsVersionToPostId: 31,
	// numAsCiteCountToPostId: 32,
	// numAsReplyCountToPostId: 33,

	space: 40,
	spaceNameToSpaceId: 41,
	spaceInviteWithAcceptanceMsAsNumToAccountId: 42,
	lastSpaceViewMsToAccountId: 43,
	spaceRoleNumAsIdToAccountId: 44,

	account: 50,
	txtAsAccountNameToAccountId: 51,
	txtAsAccountEmailToAccountId: 52,
	txtAsAccountPwHashToAccountId: 53,

	// accountIdInContactsSinceMsToAccountId: 54,
	// accountHandleToAccountId: 51,
	// contactNote: 56,

	createAccountOtpWithPinColorEmailAndStrikeCount: 61,
	signInOtpWithPinColorEmailAndStrikeCount: 62,
	resetPasswordOtpWithPinColorEmailAndStrikeCount: 63,
	txtAsClientIdToAccountId: 64,

	sessionId: 70,

	postIdWithNumAsNestedUpdatesFeedPriorityToRootPostId: 80,
});

export function splitId(id: string) {
	let s = id.split('_', 3);
	return {
		ms: s[0] ? +s[0] : null,
		by_ms: s[1] ? +s[1] : null,
		in_ms: s[2] ? +s[2] : null,
	} as const;
}

export let filterId = (id: string) => filterIdSegs(splitId(id));

export let filterIdSegs = (segs: PartInsert) => {
	return and(
		segs.ms === null || segs.ms === undefined //
			? isNull(partsTable.ms)
			: eq(partsTable.ms, segs.ms),
		segs.by_ms === null || segs.by_ms === undefined
			? isNull(partsTable.by_ms)
			: eq(partsTable.by_ms, segs.by_ms),
		segs.in_ms === null || segs.in_ms === undefined
			? isNull(partsTable.in_ms)
			: eq(partsTable.in_ms, segs.in_ms),
	);
};

export let filterIdSegsAsToIdSegs = (segs: PartInsert) =>
	and(
		segs.ms === null || segs.ms === undefined
			? isNull(partsTable.to_ms)
			: eq(partsTable.to_ms, segs.ms),
		segs.by_ms === null || segs.by_ms === undefined
			? isNull(partsTable.to_by_ms)
			: eq(partsTable.to_by_ms, segs.by_ms),
		segs.in_ms === null || segs.in_ms === undefined
			? isNull(partsTable.to_in_ms)
			: eq(partsTable.to_in_ms, segs.in_ms),
	);

export let filterToIdSegsAsIdSegs = (segs: PartInsert) =>
	and(
		segs.to_ms === null || segs.to_ms === undefined
			? isNull(partsTable.ms)
			: eq(partsTable.ms, segs.to_ms),
		segs.to_by_ms === null || segs.to_by_ms === undefined
			? isNull(partsTable.by_ms)
			: eq(partsTable.by_ms, segs.to_by_ms),
		segs.to_in_ms === null || segs.to_in_ms === undefined
			? isNull(partsTable.in_ms)
			: eq(partsTable.in_ms, segs.to_in_ms),
	);

export let filterToIdSegs = (segs: PartInsert) =>
	and(
		segs.to_ms === null || segs.to_ms === undefined
			? isNull(partsTable.to_ms)
			: eq(partsTable.to_ms, segs.to_ms),
		segs.by_ms === null || segs.by_ms === undefined
			? isNull(partsTable.to_by_ms)
			: eq(partsTable.to_by_ms, segs.by_ms),
		segs.in_ms === null || segs.in_ms === undefined
			? isNull(partsTable.to_in_ms)
			: eq(partsTable.to_in_ms, segs.in_ms),
	);

export function dropNodesTableInOpfsInDev() {
	let { sql } = new SQLocalDrizzle('mindapp.db');
	if (dev) {
		console.warn('Dropping parts table in development mode. This should NEVER run in production!');
		dev && sql`DROP TABLE "parts";`;
	}
}

export type Database = LibSQLDatabase<any> | SqliteRemoteDatabase;

export let overwriteLocalPost = async (t: PartInsert) => {
	await (await gsdb()).update(partsTable).set(t).where(filterIdSegs(t));
};

export let hasParent = (part: PartInsert) => {
	return (
		(part.to_ms !== null && part.to_ms !== undefined) ||
		(part.to_by_ms !== null && part.to_by_ms !== undefined) ||
		(part.to_in_ms !== null && part.to_in_ms !== undefined)
	);
};

export let _selectNode = async (db: Database, part: PartInsert) => {
	return (await db.select().from(partsTable).where(filterIdSegs(part)))[0] as
		| undefined
		| PartSelect;
};

export let assertLt2Rows = (rows: PartSelect[]) => {
	if (rows.length > 1) throw new Error(`Multiple rows found`);
	let row = rows[0];
	return row as undefined | PartSelect;
};

export let assert1Row = (rows: PartSelect[]) => {
	let row = assertLt2Rows(rows);
	if (!row) throw new Error(`row dne`);
	return row;
};
