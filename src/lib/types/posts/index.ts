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
	splitId,
	filterIdSegs,
	filterIdSegsAsToIdSegs,
	filterToIdSegs,
	getToId,
	filterToIdSegsAsIdSegs,
} from '../parts';

export let PostSchema = z
	.object({
		to_ms: z.number().nullish(),
		to_by_ms: z.number().nullish(),
		to_in_ms: z.number().nullish(),

		ms: z.number().nullish(),
		by_ms: z.number().nullish(),
		in_ms: z.number().nullish(),

		// replyCount: z.number().nullish(),
		// citeCount: z.number().nullish(),
		history: z.record(
			z.object({
				ms: z.number(),
				tags: z.array(z.string()).nullish(),
				body: z.string().nullish(),
			}),
		),
		subIds: z.array(z.string()).nullish(),
	})
	.strict();

export type Post = z.infer<typeof PostSchema>;

export let getLastVersion = (p: Post) => Math.max(...Object.keys(p.history).map((k) => +k));

export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

export let normalizeTags = (tags: string[]) => {
	return [...new Set(tags.map((tag) => tag.trim()))].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
};
