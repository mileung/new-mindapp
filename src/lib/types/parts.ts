import { dev } from '$app/environment';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, eq, gte, isNotNull, isNull, like, lte, not, or, SQL } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { z } from 'zod';
import { localDbFilename, gsdb } from '../local-db';
import { partsTable } from './parts-table';

export type PartInsert = typeof partsTable.$inferInsert;
export type PartSelect = typeof partsTable.$inferSelect;

export let PartInsertSchema = createInsertSchema(partsTable);
export let PartSelectSchema = createSelectSchema(partsTable);

export let SplitIdToSplitIdSchema = z.object({
	to_ms: z.number().nullish(),
	to_by_ms: z.number().nullish(),
	to_in_ms: z.number().nullish(),
	ms: z.number().nullish(),
	by_ms: z.number().nullish(),
	in_ms: z.number().nullish(),
});

export type SplitIdToSplitId = z.infer<typeof SplitIdToSplitIdSchema>;

export let SplitIdSchema = z.object({
	ms: z.number().nullish(),
	by_ms: z.number().nullish(),
	in_ms: z.number().nullish(),
});

export type SplitId = z.infer<typeof SplitIdSchema>;

export let getSplitIdToSplitId = (idToSplitId: SplitIdToSplitId) => ({
	to_ms: idToSplitId.to_ms,
	to_by_ms: idToSplitId.to_by_ms,
	to_in_ms: idToSplitId.to_in_ms,
	ms: idToSplitId.ms,
	by_ms: idToSplitId.by_ms,
	in_ms: idToSplitId.in_ms,
});

export let getToSplitIdAsSplitId = (idToSplitId: SplitIdToSplitId) => ({
	ms: idToSplitId.to_ms,
	by_ms: idToSplitId.to_by_ms,
	in_ms: idToSplitId.to_in_ms,
});

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

	currentPostBodyTxtWithMsAndNumAsVersionToPostId: 20,
	exPostBodyTxtWithMsAndNumAsVersionToPostId: 21,

	tagTxtAndNumAsCount: 30,

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
	// lonePostIdWithNumAsNestedUpdatesFeedPriority: 81,
});

export function getSplitId(id: string) {
	let s = id.split('_', 3);
	return {
		ms: s[0] ? +s[0] : null,
		by_ms: s[1] ? +s[1] : null,
		in_ms: s[2] ? +s[2] : null,
	} as const;
}

export let getIdFilter = (id: string) => filterSplitId(getSplitId(id));

export let filterSplitId = (splitId: SplitId) => {
	return and(
		splitId.ms === null || splitId.ms === undefined //
			? isNull(partsTable.ms)
			: eq(partsTable.ms, splitId.ms),
		splitId.by_ms === null || splitId.by_ms === undefined
			? isNull(partsTable.by_ms)
			: eq(partsTable.by_ms, splitId.by_ms),
		splitId.in_ms === null || splitId.in_ms === undefined
			? isNull(partsTable.in_ms)
			: eq(partsTable.in_ms, splitId.in_ms),
	);
};

export let filterSplitIdAsToSplitId = (splitId: SplitId) =>
	and(
		splitId.ms === null || splitId.ms === undefined
			? isNull(partsTable.to_ms)
			: eq(partsTable.to_ms, splitId.ms),
		splitId.by_ms === null || splitId.by_ms === undefined
			? isNull(partsTable.to_by_ms)
			: eq(partsTable.to_by_ms, splitId.by_ms),
		splitId.in_ms === null || splitId.in_ms === undefined
			? isNull(partsTable.to_in_ms)
			: eq(partsTable.to_in_ms, splitId.in_ms),
	);

export let filterToSplitIdAsSplitId = (splitIdToSplitId: SplitIdToSplitId) =>
	and(
		splitIdToSplitId.to_ms === null || splitIdToSplitId.to_ms === undefined
			? isNull(partsTable.ms)
			: eq(partsTable.ms, splitIdToSplitId.to_ms),
		splitIdToSplitId.to_by_ms === null || splitIdToSplitId.to_by_ms === undefined
			? isNull(partsTable.by_ms)
			: eq(partsTable.by_ms, splitIdToSplitId.to_by_ms),
		splitIdToSplitId.to_in_ms === null || splitIdToSplitId.to_in_ms === undefined
			? isNull(partsTable.in_ms)
			: eq(partsTable.in_ms, splitIdToSplitId.to_in_ms),
	);

export let filterToSplitId = (splitIdToSplitId: SplitIdToSplitId) =>
	and(
		splitIdToSplitId.to_ms === null || splitIdToSplitId.to_ms === undefined
			? isNull(partsTable.to_ms)
			: eq(partsTable.to_ms, splitIdToSplitId.to_ms),
		splitIdToSplitId.by_ms === null || splitIdToSplitId.by_ms === undefined
			? isNull(partsTable.to_by_ms)
			: eq(partsTable.to_by_ms, splitIdToSplitId.by_ms),
		splitIdToSplitId.in_ms === null || splitIdToSplitId.in_ms === undefined
			? isNull(partsTable.to_in_ms)
			: eq(partsTable.to_in_ms, splitIdToSplitId.in_ms),
	);

export type Database = LibSQLDatabase<any> | SqliteRemoteDatabase;

export let overwriteLocalPost = async (t: PartInsert) => {
	await (await gsdb()).update(partsTable).set(t).where(filterSplitId(t));
};

export let hasParent = (part: PartInsert) => {
	return (
		(part.to_ms !== null && part.to_ms !== undefined) ||
		(part.to_by_ms !== null && part.to_by_ms !== undefined) ||
		(part.to_in_ms !== null && part.to_in_ms !== undefined)
	);
};

export let _selectNode = async (db: Database, part: PartInsert) => {
	return (await db.select().from(partsTable).where(filterSplitId(part)))[0] as
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
