import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { gs } from './globalState.svelte';
import { and, asc, desc, eq, gte, isNull, like, lte, or } from 'drizzle-orm';
import { dev } from '$app/environment';
import type { SQLocalDrizzle } from 'sqlocal/drizzle';

export const thoughtsTable = sqliteTable(
	'thoughts',
	{
		by_id: text('by_id'),
		ms: integer('ms').notNull(),
		to_id: text('to_id'),
		body: text('body'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
	},
	(table) => [
		// https://orm.drizzle.team/docs/indexes-constraints#composite-primary-key
		primaryKey({
			name: 'id',
			columns: [table.by_id, table.ms],
		}),
		index('by_id_idx').on(table.by_id),
		index('ms_idx').on(table.ms),
		index('to_id_idx').on(table.to_id),
		index('body_idx').on(table.body),
		index('tags_idx').on(table.tags),
	],
);

export type ThoughtInsert = typeof thoughtsTable.$inferInsert;
export type ThoughtSelect = typeof thoughtsTable.$inferSelect;

export function getThoughtId(thought: ThoughtSelect) {
	return `${thought.ms}_${thought.by_id || ''}`;
}

const thoughtIdRegex = /^\d{9,}_(|[A-HJ-NP-Za-km-z1-9]{9,})$/;
export function isThoughtId(str = '') {
	return thoughtIdRegex.test(str);
}

// export let loadThoughtsHierarchically = async (q: {
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

export let loadThoughtsChronologically = async (q: {
	from?: number;
	mode?: 'new' | 'old';
	thoughtId?: string;
	authorIds?: string[];
	tags?: string[];
	other?: string[];
	thoughtsBeyond?: number;
}) => {
	const oldToNew = q.mode === 'old';
	let latestCreateDate = oldToNew ? 0 : Number.MAX_SAFE_INTEGER;
	const rootsPerLoad = 10;

	let offset = 0;
	const thoughts: ThoughtSelect[] = await gs.db
		.select()
		.from(thoughtsTable)
		.where(
			and(
				or(
					...(q.authorIds || []).map((id) =>
						id ? eq(thoughtsTable.by_id, id) : isNull(thoughtsTable.by_id),
					),
				),
				q.thoughtId
					? like(thoughtsTable.body, `%${q.thoughtId}%`)
					: or(
							...(q.tags || []).map((tag) => like(thoughtsTable.tags, `%"${tag}"%`)),
							...(q.other || []).map((term) => like(thoughtsTable.body, `%${term}%`)),
						),
				(oldToNew ? gte : lte)(thoughtsTable.ms, q.thoughtsBeyond || Date.now()),
			),
		)
		.orderBy((oldToNew ? asc : desc)(thoughtsTable.ms))
		.limit(10)
		.offset(offset++);

	const newThoughts = { ...gs.thoughts };
	thoughts.forEach((t) => (newThoughts[getThoughtId(t)] = t));
	gs.thoughts = newThoughts;

	return { thoughts };
};

type ThoughtSelector = {
	ms?: number;
	by_id?: string;
	id?: string;
};

function filterId(a: ThoughtSelector) {
	let { ms, by_id } = a;
	if (!ms && a.id) {
		let s = a.id.split('_', 2);
		ms = +s[0];
		by_id = s[1];
	}
	if (!ms) throw new Error('No ms in thought filter');
	return and(
		eq(thoughtsTable.ms, ms),
		by_id //
			? eq(thoughtsTable.by_id, by_id)
			: isNull(thoughtsTable.by_id),
	);
}

export async function deleteThought(a: ThoughtSelector) {
	return await gs.db.delete(thoughtsTable).where(filterId(a));
}

export let dropThoughtsTableInDev = (sql: SQLocalDrizzle['sql']) =>
	dev && sql`DROP TABLE "thoughts";`;
