import { dev } from '$app/environment';
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
} from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { gs } from './globalState.svelte';
import { m } from './paraglide/messages';
import { minute } from './time';
import { sortUniArr } from './js';

// https://sqlocal.dev/guide/introduction
export async function initLocalDb() {
	let { sql } = new SQLocalDrizzle('mindapp.db');
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

export let thoughtsTable = sqliteTable(
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
		// https://orm.drizzle.team/docs/indexes-letraints#composite-primary-key
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
export type ThoughtNested = ThoughtInsert & { children?: ThoughtNested[]; childIds?: string[] };
export let ThoughtInsertSchema = createInsertSchema(thoughtsTable);
export let ThoughtSelectSchema = createSelectSchema(thoughtsTable);

type IdSegments = Pick<ThoughtInsert, 'ms' | 'by_id' | 'in_id'>;
export let getId = (thought: IdSegments) =>
	`${thought.ms || ''}_${thought.by_id || ''}_${thought.in_id || ''}`;

export let idRegex = /^\d*_\d*_\d*$/;
export let idsRegex = /(^|\s)\d*_\d*_\d*($|\s)/g;

export let isId = (str = '') => idRegex.test(str);

export function splitId(id: string) {
	let s = id.split('_', 3);
	let segs = { ms: s[0], by_id: s[1], in_id: s[2] };
	return segs;
}

export function getIdFilter(id: string) {
	let { ms, by_id, in_id } = splitId(id);
	return and(
		ms ? eq(thoughtsTable.ms, +ms) : isNull(thoughtsTable.ms),
		by_id ? eq(thoughtsTable.by_id, +by_id) : isNull(thoughtsTable.by_id),
		in_id ? eq(thoughtsTable.in_id, +in_id) : isNull(thoughtsTable.in_id),
	);
}

export function dropThoughtsTableInDev() {
	let { sql } = new SQLocalDrizzle('mindapp.db');
	if (dev) {
		console.warn(
			'Dropping thoughts table in development mode. This should NEVER run in production!',
		);
		dev && sql`DROP TABLE "thoughts";`;
	}
}

export async function gsdb() {
	let attempts = 0;
	while (!gs.db) {
		if (++attempts > 88) {
			alert(m.localDatabaseTimedOut());
			throw new Error(m.localDatabaseTimedOut());
		}
		await new Promise((res) => setTimeout(res, 100));
	}
	return gs.db;
}

export async function addThought(t: ThoughtInsert) {
	if (typeof t.in_id === 'number') {
		if (!t.by_id) throw new Error('Missing by_id');
		// TODO: Verify user by_id is logged and has access to space in_id
	}
	if (!(t.tags || []).every((t) => t.length === t.trim().length))
		throw new Error('Every tag must be trimmed');
	let ms = Date.now();
	await (await gsdb()).insert(thoughtsTable).values({ ...t, ms });
	return ms;
}

// let readOnlyTags = new Set([' edited:<ms>', ' deleted']);
export function divideTags(thought: ThoughtInsert) {
	let authorTags: string[] = [];
	let readOnlyTags: string[] = [];
	(thought.tags || []).forEach((t) => (t[0] === ' ' ? readOnlyTags : authorTags).push(t));
	return { authorTags, readOnlyTags };
}

export async function editThought(t: ThoughtInsert) {
	if (!t.ms) throw new Error('Missing ms');
	if (t.tags?.[0] === ' deleted') throw new Error('Cannot edit deleted thoughts');
	if (typeof t.in_id === 'number') {
		if (!t.by_id) throw new Error('Missing by_id');
		// TODO: Verify user by_id is logged and has access to space in_id
	}
	let originalThought = await getThought(getId(t));
	if (!originalThought) throw new Error('Original thought not found');
	let { readOnlyTags } = divideTags(originalThought);
	let { authorTags } = divideTags(t);
	if (!authorTags.every((t) => t.length === t.trim().length))
		throw new Error('Every tag must be trimmed');

	let tags = sortUniArr([
		` edited:${Date.now()}`,
		...readOnlyTags.filter((t) => !t.startsWith(' edited:')),
		...authorTags,
	]);
	await (
		await gsdb()
	)
		.update(thoughtsTable)
		.set({ ...t, tags })
		.where(getIdFilter(getId(t)));
	return tags;
}

export async function deleteThought(id: string) {
	let s = splitId(id);
	if (s.in_id) {
		if (!s.by_id) throw new Error('Missing by_id');
		// TODO: Verify user by_id is logged and has access to space in_id
	}
	if ((await getThoughtChildren(id, 1)).length) {
		await (
			await gsdb()
		)
			.update(thoughtsTable)
			.set({
				body: null,
				tags: [' deleted'],
			})
			.where(getIdFilter(id));
		return { soft: true };
	} else {
		await (await gsdb()).delete(thoughtsTable).where(getIdFilter(id));
		return { soft: false };
	}
}

// TODO: paginate children when there's too many with fromMs
// Reddit does this - HN does not
export async function getThoughtChildren(id: string, limit = -1) {
	let children = await (await gsdb())
		.select()
		.from(thoughtsTable)
		.where(eq(thoughtsTable.to_id, id))
		.orderBy(desc(thoughtsTable.ms))
		.limit(limit);
	return children;
}

export async function getThought(id: string): Promise<ThoughtSelect | undefined> {
	return (await (await gsdb()).select().from(thoughtsTable).where(getIdFilter(id)).limit(1))[0];
}

async function getRootThought(thought: ThoughtSelect) {
	let rootThought = thought;
	// let interThoughts: Record<string, ThoughtSelect> = {};
	while (rootThought?.to_id) {
		// interThoughts[getId(thought)] = rootThought;
		let toThought = await getThought(rootThought.to_id);
		if (toThought) rootThought = toThought;
	}
	return {
		rootThought,
		// TODO: maybe make loading thoughts more efficient by not getting rows that have already been gotten?
		// interThoughts
	};
}

export let getIds = (str = '') => [...str.matchAll(idsRegex)].map((match) => match[0].trim());

async function expandThought(thought: ThoughtSelect): Promise<{
	citedIds: string[];
	byIds: (null | number)[];
	nestedThought: ThoughtNested;
}> {
	let citedIds = getIds(thought.body || '');
	let byIds = [thought.by_id];
	let children: ThoughtNested[] = await Promise.all(
		(await getThoughtChildren(getId(thought))).map(async (t) => {
			let exp = await expandThought(t);
			citedIds.push(...exp.citedIds);
			byIds.push(...exp.byIds);
			return exp.nestedThought;
		}),
	);
	return {
		citedIds,
		byIds,
		nestedThought: { ...thought, ...(children.length ? { children } : {}) },
	};
}

export let rootsPerLoad = 15;
export let loadThoughts = async (q: {
	rpc?: boolean;
	spaceId?: number;
	nested?: boolean;
	oldestFirst?: boolean; // TODO: implementing this will require more data analyzing to ensure the right fromMs is sent. e.g. What to do when appending a new thought to an oldest first feed and the newest thoughts haven't been fetched yet?
	fromMs: number;
	thoughtsBeyond?: number;
	idsInclude?: string[];
	idsExclude?: string[];
	byIdsInclude?: number[];
	byIdsExclude?: number[];
	tagsInclude?: string[];
	tagsExclude?: string[];
	bodyIncludes?: string[];
	bodyExcludes?: string[];
}) => {
	let {
		rpc = false,
		spaceId,
		nested = false,
		oldestFirst = false,
		fromMs,
		idsInclude = [],
		idsExclude = [],
		byIdsInclude = [],
		byIdsExclude = [],
		tagsInclude = [],
		tagsExclude = [],
		bodyIncludes = [],
		bodyExcludes = [],
	} = q;
	if (spaceId === undefined) {
		// TODO: query local sqlite db
	} else {
		// TODO: query Turso db
	}

	let idsExcludeSet = new Set(idsExclude);
	let db = await gsdb();
	let roots: ThoughtNested[] = [];
	let byIds: (null | number)[] = [];
	let toIds: string[] = [];
	let citedIds: string[] = [];
	let auxThoughts: Record<string, ThoughtSelect> = {};
	let baseFilters = [
		isNotNull(thoughtsTable.ms),
		(oldestFirst ? gte : lte)(thoughtsTable.ms, fromMs),
		// not(like(thoughtsTable.tags, `%" private"%`)),
		or(...idsInclude.map((id) => getIdFilter(id))),
		or(...byIdsInclude.map((id) => eq(thoughtsTable.by_id, id))),
		or(...tagsInclude.map((tag) => like(thoughtsTable.tags, `%"${tag}"%`))),
		or(...bodyIncludes.map((term) => like(thoughtsTable.body, `%${term}%`))),
		...idsExclude.map((id) => {
			let filter = getIdFilter(id);
			return filter ? not(filter) : undefined;
		}),
		...byIdsExclude.map((id) => not(eq(thoughtsTable.by_id, id))),
		...tagsExclude.map((tag) => notLike(thoughtsTable.tags, `%"${tag}"%`)),
		...bodyExcludes.map((term) => notLike(thoughtsTable.body, `%${term}%`)),
	];

	if (nested) {
		let offset = 0;
		while (true) {
			let [currentRow] = await db
				.select()
				.from(thoughtsTable)
				.where(and(...baseFilters))
				.orderBy((oldestFirst ? asc : desc)(thoughtsTable.ms))
				.limit(1)
				.offset(offset++);
			if (!currentRow) break;
			let {
				rootThought, //interThoughts
			} = await getRootThought(currentRow);
			if (
				!idsExcludeSet.has(getId(rootThought)) &&
				!roots.find((root) => getId(root) === getId(rootThought))
			) {
				let et = await expandThought(rootThought);
				citedIds.push(...et.citedIds);
				byIds.push(...et.byIds);
				roots.push(et.nestedThought);
			}
			if (roots.length === rootsPerLoad) break;
		}
	} else {
		roots = await db
			.select()
			.from(thoughtsTable)
			.where(and(...baseFilters))
			.orderBy((oldestFirst ? asc : desc)(thoughtsTable.ms))
			.limit(rootsPerLoad);

		// TODO: I shouldn't have to add a bang to r.to_id!. TypeScript bug? Don't want to use typeof i==='string' in filter
		toIds = roots.map((r) => r.to_id!).filter((i) => !!i);
		citedIds = roots.flatMap((r) =>
			[...(r.body || '').matchAll(idsRegex)].map((m) => m[0].trim()).filter((i) => !!i),
		);
	}

	await Promise.all(
		[...new Set([...citedIds, ...(nested ? toIds : [])])].map((id) => {
			return getThought(id).then((thought) => {
				if (thought) {
					auxThoughts[id] = thought;
					byIds.push(auxThoughts[id].by_id);
				}
			});
		}),
	);
	// await Promise.all(
	// 	[...new Set(byIds)].map((id) => {
	// 		if (id) return getThought().then((a) => a && (authors[id] = a));
	// 	}),
	// );

	return { roots, auxThoughts };
};
