import { dev } from '$app/environment';
// import { tdb } from '$lib/server/db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, eq, gte, isNotNull, isNull, like, lte, not, or, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { z } from 'zod';
import { gsdb } from '../../local-db';
import { partsTable } from '../parts-table';
import {
	assert1Row,
	getId,
	hasParent,
	partCodes,
	type Database,
	type PartInsert,
	type PartSelect,
	idsRegex,
	getSplitId,
	filterSplitId,
	filterSplitIdAsToSplitId,
	filterToSplitId,
	getToId,
	filterToSplitIdAsSplitId,
} from '../parts';

export let PostSchema = z
	.object({
		to_ms: z.number().nullish(),
		to_by_ms: z.number().nullish(),
		to_in_ms: z.number().nullish(),

		ms: z.number(),
		by_ms: z.number().nullish(),
		in_ms: z.number().nullish(),

		history: z
			.record(
				z
					.object({
						ms: z.number(),
						tags: z.array(z.string()).optional(),
						body: z.string().nullable(),
					})
					.nullish(),
			)
			.nullable(),
		subIds: z.array(z.string()).optional(),
	})
	.strict();

export type Post = z.infer<typeof PostSchema>;

export let getLastVersion = (p: Post) =>
	p.history && Math.max(...Object.keys(p.history).map((k) => +k));

export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

export let normalizeTags = (tags: string[]) => {
	return [...new Set(tags.map((tag) => tag.trim()).filter((t) => !!t))].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
};

export let scrollToHighlight = (id: string) => {
	let e =
		document.querySelector('#m' + id) || //
		document.querySelector('.m' + id);
	e?.scrollIntoView({ block: 'start' });
};

export let bumpTagCountsBy1 = async (db: Database, tagRows: PartInsert[], increment = true) =>
	tagRows.length &&
	(await db
		.update(partsTable)
		.set({ num: increment ? sql`${partsTable.num} + 1` : sql`${partsTable.num} - 1` })
		.where(
			and(
				isNull(partsTable.to_ms),
				isNull(partsTable.to_by_ms),
				isNull(partsTable.to_in_ms),
				or(...tagRows.map((tagRow) => and(filterSplitId(tagRow), eq(partsTable.txt, tagRow.txt!)))),
				eq(partsTable.code, partCodes.tagTxtAndNumAsCount),
				isNotNull(partsTable.num),
			),
		));
