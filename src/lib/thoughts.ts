import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { gs } from './globalState.svelte';
import {
	and,
	asc,
	desc,
	eq,
	gte,
	isNotNull,
	isNull,
	like,
	lte,
	not,
	notLike,
	or,
	SQL,
	type SQLWrapper,
} from 'drizzle-orm';
import { dev } from '$app/environment';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { m } from './paraglide/messages';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// https://sqlocal.dev/guide/introduction
export async function initLocalDb() {
	const { sql } = new SQLocalDrizzle('mindapp.db');
	try {
		await sql`
			PRAGMA journal_mode=WAL;
			CREATE TABLE IF NOT EXISTS thoughts (
				ms INTEGER,
				tags TEXT,
				body TEXT,
				by_id INTEGER,
				to_id TEXT,
				in_id INTEGER,
				CONSTRAINT thought_id PRIMARY KEY (ms, by_id, in_id)
			);
			CREATE INDEX IF NOT EXISTS ms_idx ON thoughts (ms);
			CREATE INDEX IF NOT EXISTS tags_idx ON thoughts (tags);
			CREATE INDEX IF NOT EXISTS body_idx ON thoughts (body);
			CREATE INDEX IF NOT EXISTS by_id_idx ON thoughts (by_id);
			CREATE INDEX IF NOT EXISTS to_id_idx ON thoughts (to_id);
			CREATE INDEX IF NOT EXISTS in_id_idx ON thoughts (in_id);
	`;
	} catch (error) {
		console.log('error:', error);
	}
}

export const thoughtsTable = sqliteTable(
	'thoughts',
	{
		ms: integer('ms'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
		body: text('body'),
		by_id: integer('by_id'),
		to_id: text('to_id'),
		in_id: integer('in_id'),
	},
	(table) => [
		// https://orm.drizzle.team/docs/indexes-constraints#composite-primary-key
		primaryKey({
			name: 'thought_id',
			columns: [table.ms, table.by_id, table.in_id],
		}),
		index('ms_idx').on(table.ms),
		index('tags_idx').on(table.tags),
		index('body_idx').on(table.body),
		index('by_id_idx').on(table.by_id),
		index('to_id_idx').on(table.to_id),
		index('in_id_idx').on(table.in_id),
	],
);

export type ThoughtInsert = typeof thoughtsTable.$inferInsert;
export type ThoughtSelect = typeof thoughtsTable.$inferSelect;
export let ThoughtInsertSchema = createInsertSchema(thoughtsTable);
export let ThoughtSelectSchema = createSelectSchema(thoughtsTable);

type ThoughtIdSegments = Pick<ThoughtInsert, 'ms' | 'by_id' | 'in_id'>;
export function getThoughtId(thought: ThoughtIdSegments) {
	return `${thought.ms || ''}_${thought.by_id || ''}_${thought.in_id || ''}`;
}

const thoughtIdRegex = /^\d*_\d*_\d*$/;
export function isThoughtId(str = '') {
	return thoughtIdRegex.test(str);
}

type ThoughtSelector = ThoughtIdSegments & { id?: string };
export function filterThoughtId(t: ThoughtSelector) {
	let { ms, by_id, in_id } = t;
	if (t.id) {
		if (ms || by_id || in_id) {
			if (getThoughtId(t) !== t.id) throw new Error('id mismatch');
		}
		let s = t.id.split('_', 3);
		ms = +s[0];
		by_id = +s[1];
		in_id = +s[1];
	}
	if (Number.isNaN(ms) || Number.isNaN(by_id) || Number.isNaN(in_id))
		throw new Error('Invalid thought id');
	return and(
		ms ? eq(thoughtsTable.ms, ms) : isNull(thoughtsTable.ms),
		by_id ? eq(thoughtsTable.by_id, by_id) : isNull(thoughtsTable.by_id),
		in_id ? eq(thoughtsTable.in_id, in_id) : isNull(thoughtsTable.in_id),
	);
}

export function getThoughtIdSegments(t: ThoughtSelector): ThoughtIdSegments {
	let { ms, by_id, in_id } = t;
	if (t.id) {
		if (ms || by_id || in_id) {
			if (getThoughtId(t) !== t.id) throw new Error('id mismatch');
		}
		let s = t.id.split('_', 3);
		ms = +s[0];
		by_id = +s[1];
		in_id = +s[2];
	}
	if (Number.isNaN(ms) || Number.isNaN(by_id) || Number.isNaN(in_id))
		throw new Error('Invalid thought id');
	return { ms, by_id, in_id };
}

export async function gsdb() {
	let attempts = 0;
	while (!gs.db) {
		if (++attempts > 9) {
			alert(m.localDatabaseTimedOut());
			throw new Error(m.localDatabaseTimedOut());
		}
		await new Promise((res) => setTimeout(res, 100));
	}
	return gs.db;
}

export async function overwriteThought(t: ThoughtInsert) {
	return await (await gsdb()).update(thoughtsTable).set(t).where(filterThoughtId(t));
}

export async function deleteThought(t: ThoughtSelector) {
	return await (await gsdb()).delete(thoughtsTable).where(filterThoughtId(t));
}

export function dropThoughtsTableInDev() {
	const { sql } = new SQLocalDrizzle('mindapp.db');
	if (dev) {
		console.warn(
			'Dropping thoughts table in development mode. This should NEVER run in production!',
		);
		dev && sql`DROP TABLE "thoughts";`;
	}
}

export let rootsPerLoad = 10;

export let loadRoots = async (q: {
	rpc?: boolean;
	hierarchical?: boolean;
	oldestFirst?: boolean;
	fromMs?: number;
	thoughtsBeyond?: number;
	thoughtId?: string;
	excludeIds?: ThoughtSelector[];
	authorIdsInclude?: number[];
	authorIdsExclude?: number[];
	tagsInclude?: string[];
	tagsExclude?: string[];
	bodyIncludes?: string[];
	bodyExcludes?: string[];
}) => {
	let {
		rpc = false,
		hierarchical = false,
		oldestFirst = false,
		fromMs = q.oldestFirst ? 0 : Number.MAX_SAFE_INTEGER,
		thoughtId,
		excludeIds = [],
		authorIdsInclude = [],
		authorIdsExclude = [],
		tagsInclude = [],
		tagsExclude = [],
		bodyIncludes = [],
		bodyExcludes = [],
	} = q;

	let offset = 0;
	const thoughts: ThoughtSelect[] = await (
		await gsdb()
	)
		.select()
		.from(thoughtsTable)
		.where(
			thoughtId
				? filterThoughtId({ id: thoughtId })
				: and(
						isNotNull(thoughtsTable.ms),
						...excludeIds.map((id) => {
							let filter = filterThoughtId(id);
							if (filter) filter = not(filter);
							return filter;
						}),
						...authorIdsInclude.map((id) => eq(thoughtsTable.by_id, id)),
						...authorIdsExclude.map((id) => not(eq(thoughtsTable.by_id, id))),
						...tagsInclude.map((tag) => like(thoughtsTable.tags, `%"${tag}"%`)),
						...tagsExclude.map((tag) => notLike(thoughtsTable.tags, `%"${tag}"%`)),
						...bodyIncludes.map((term) => like(thoughtsTable.body, `%${term}%`)),
						...bodyExcludes.map((term) => notLike(thoughtsTable.body, `%${term}%`)),
						(oldestFirst ? gte : lte)(thoughtsTable.ms, fromMs || Date.now()),
					),
		)
		.orderBy((oldestFirst ? asc : desc)(thoughtsTable.ms))
		.limit(rootsPerLoad)
		.offset(offset++);

	// TODO: only do this for client side queries
	const newThoughts = { ...gs.thoughts };
	thoughts.forEach((t) => (newThoughts[getThoughtId(t)] = t));
	gs.thoughts = newThoughts;

	return { roots: thoughts };
};

// export let loadRootsHierarchically = async (q: {
// 	from: number;
// 	mode: 'new' | 'old';
// 	thoughtId?: string;
// 	authorIds?: string[];
// 	tags?: string[];
// 	other?: string[];
// 	ignoreRootIds: string[];
// 	thoughtsBeyond: number;
// }) => {
// 	const { from, mode, thoughtId, authorIds, tags = [], other = [], ignoreRootIds, thoughtsBeyond } = q;

// 	const oldToNew = mode === 'old';
// 	const excludeIds = new Set(ignoreRootIds);
// 	const roots: ThoughtSelect[] = [];
// 	const mentionedThoughtIds = new Set<string>();
// 	const allAuthorIdsSet = new Set<string>();
// 	let latestCreateDate = oldToNew ? 0 : Number.MAX_SAFE_INTEGER;
// 	const rootsPerLoad = 8;

// 	if (thoughtId && !ignoreRootIds.length) {
// 		const thought = await gs.db
// 			.select()
// 			.from(thoughtsTable)
// 			.where(eq(thoughtsTable.by_id, thoughtId))
// 			.limit(1)
// 			.then((rows) => rows[0]);

// 		if (!thought) {
// 			return { mentionedThoughts: {}, roots: [] };
// 		}

// 		const rootThought = await new Thought(thought).getRootThought();
// 		const { clientProps, allMentionedIds, allAuthorIds } = await rootThought.expand(from);
// 		allMentionedIds.forEach((id) => mentionedThoughtIds.add(id));
// 		allAuthorIds.forEach((id) => allAuthorIdsSet.add(id));
// 		roots.push(clientProps);
// 	}

// 	let offset = 0;
// 	while (true) {
// 		const [currentRow] = await gs.db
// 			.select()
// 			.from(thoughtsTable)
// 			.where(
// 				and(
// 					or(
// 						...(authorIds || []).map((id) =>
// 							id ? eq(thoughtsTable.by_id, id) : isNull(thoughtsTable.by_id),
// 						),
// 					),
// 					thoughtId
// 						? like(thoughtsTable.body, `%${thoughtId}%`)
// 						: or(
// 								...tags.map((tag) => like(thoughtsTable.tags, `%"${tag}"%`)),
// 								...other.map((term) => like(thoughtsTable.body, `%${term}%`)),
// 							),
// 					(oldToNew ? gte : lte)(thoughtsTable.ms, thoughtsBeyond),
// 				),
// 			)
// 			.orderBy((oldToNew ? asc : desc)(thoughtsTable.ms))
// 			.limit(1)
// 			.offset(offset++);

// 		if (!currentRow) break;
// 		const rootThought = await new Thought(currentRow).getRootThought();
// 		if (
// 			!excludeIds.has(rootThought.id) &&
// 			!roots.find((root) => new Thought(root).id === rootThought.id)
// 		) {
// 			const { clientProps, allMentionedIds, allAuthorIds } = await rootThought.expand(from);
// 			allMentionedIds.forEach((id) => mentionedThoughtIds.add(id));
// 			allAuthorIds.forEach((id) => allAuthorIdsSet.add(id));
// 			roots.push(clientProps);
// 		}
// 		latestCreateDate = (oldToNew ? Math.max : Math.min)(latestCreateDate, currentRow.ms);
// 		if (roots.length === rootsPerLoad) {
// 			break;
// 		}
// 	}

// 	return { latestCreateDate, roots };
// };
