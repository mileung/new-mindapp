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
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { sortUniArr } from './js';
import { gsdb } from './local-db';
import { thoughtsTable } from './thoughts-table';

export type ThoughtInsert = typeof thoughtsTable.$inferInsert;
export type ThoughtSelect = typeof thoughtsTable.$inferSelect;
export type ThoughtNested = ThoughtInsert & { children?: ThoughtNested[]; childIds?: string[] };
export let ThoughtInsertSchema = createInsertSchema(thoughtsTable);
export let ThoughtSelectSchema = createSelectSchema(thoughtsTable);

type IdSegments = Pick<ThoughtInsert, 'ms' | 'by_ms' | 'in_ms'>;
export let getId = (thought: IdSegments) =>
	`${thought.ms || ''}_${thought.by_ms || ''}_${thought.in_ms || ''}`;

export let idRegex = /^\d*_\d*_\d*$/;
export let idsRegex = /(^|\s)\d*_\d*_\d*($|\s)/g;

export let isId = (str = '') => idRegex.test(str);

export function splitId(id: string) {
	let s = id.split('_', 3);
	let segs = { ms: s[0], by_ms: s[1], in_ms: s[2] };
	return segs;
}

export let filterThought = (t: ThoughtInsert) => filterId(getId(t));

export let filterId = (id: string) => {
	let { ms, by_ms, in_ms } = splitId(id);
	return and(
		ms ? eq(thoughtsTable.ms, +ms) : isNull(thoughtsTable.ms),
		by_ms ? eq(thoughtsTable.by_ms, +by_ms) : isNull(thoughtsTable.by_ms),
		in_ms ? eq(thoughtsTable.in_ms, +in_ms) : isNull(thoughtsTable.in_ms),
	);
};

export function dropThoughtsTableInOpfsInDev() {
	let { sql } = new SQLocalDrizzle('mindapp.db');
	if (dev) {
		console.warn(
			'Dropping thoughts table in development mode. This should NEVER run in production!',
		);
		dev && sql`DROP TABLE "thoughts";`;
	}
}

type Database = LibSQLDatabase | SqliteRemoteDatabase;

export let addThought = async (t: ThoughtInsert) => _addThought(t);

export let _addThought = async (t: ThoughtInsert) => {
	if (typeof t.in_ms === 'number') {
		if (!t.by_ms) throw new Error('Missing by_ms');
		// TODO: Verify user by_ms is logged and has access to space in_ms
	}
	if (!(t.tags || []).every((t) => t.length === t.trim().length))
		throw new Error('Every tag must be trimmed');
	let ms = Date.now();
	// gs.accounts[0].currentSpaceMs
	await (await gsdb()).insert(thoughtsTable).values({ ...t, ms });
	return ms;
};

// let systemTags = new Set([' edited:<ms>', ' deleted']);
export function divideTags(thought: ThoughtInsert) {
	let authorTags: string[] = [];
	let systemTags: string[] = [];
	(thought.tags || []).forEach((t) => (t[0] === ' ' ? systemTags : authorTags).push(t));
	return { authorTags, systemTags };
}

export let editThought = async (t: ThoughtInsert) => _editThought(t);

export let _editThought = async (t: ThoughtInsert) => {
	if (!t.ms) throw new Error('Missing ms');
	if (t.tags?.[0] === ' deleted') throw new Error('Cannot edit deleted thoughts');
	if (typeof t.in_ms === 'number') {
		if (!t.by_ms) throw new Error('Missing by_ms');
		// TODO: Verify user by_ms is logged and has access to space in_ms
	}
	let originalThought = await getThought(getId(t));
	if (!originalThought) throw new Error('Original thought not found');
	let { systemTags } = divideTags(originalThought);
	let { authorTags } = divideTags(t);
	if (!authorTags.every((t) => t.length === t.trim().length))
		throw new Error('Every tag must be trimmed');

	let tags = sortUniArr([
		` edited:${Date.now()}`,
		...systemTags.filter((t) => !t.startsWith(' edited:')),
		...authorTags,
	]);
	await (
		await gsdb()
	)
		.update(thoughtsTable)
		.set({ ...t, tags })
		.where(filterThought(t));
	return tags;
};

// export async function updateThought(id: string) {}

// TODO: paginate children when there's too many with fromMs
// Reddit does this - HN does not
let getThoughtChildren = async (id: string, limit = -1) => _getThoughtChildren(id, limit);

let _getThoughtChildren = async (id: string, limit = -1) => {
	let children = await (await gsdb())
		.select()
		.from(thoughtsTable)
		.where(eq(thoughtsTable.to_id, id))
		.orderBy(desc(thoughtsTable.ms))
		.limit(limit);
	return children;
};

export let deleteThought = async (id: string) => _deleteThought(id);

export let _deleteThought = async (id: string) => {
	let s = splitId(id);
	if (s.in_ms) {
		if (!s.by_ms) throw new Error('Missing by_ms');
		// TODO: Verify user by_ms is logged and has access to space in_ms
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
			.where(filterId(id));
		return { soft: true };
	} else {
		await (await gsdb()).delete(thoughtsTable).where(filterId(id));
		return { soft: false };
	}
};

export let getThought = async (id: string) => _getThought(id);

export let _getThought = async (id: string): Promise<ThoughtSelect | undefined> => {
	return (await (await gsdb()).select().from(thoughtsTable).where(filterId(id)).limit(1))[0];
};

let getRootThought = async (thought: ThoughtSelect) => _getRootThought(thought);

let _getRootThought = async (thought: ThoughtSelect) => {
	let rootThought = thought;
	// let interThoughts: Record<string, ThoughtSelect> = {};
	while (rootThought?.to_id) {
		// interThoughts[getId(thought)] = rootThought;
		let toThought = await _getThought(rootThought.to_id);
		if (toThought) rootThought = toThought;
	}
	return {
		rootThought,
		// TODO: maybe make loading thoughts more efficient by not getting rows that have already been gotten?
		// interThoughts
	};
};

export let getIds = (str = '') => [...str.matchAll(idsRegex)].map((match) => match[0].trim());

let expandThought = async (thought: ThoughtSelect) => _expandThought(thought);

let _expandThought = async (
	thought: ThoughtSelect,
): Promise<{
	citedIds: string[];
	byMss: (null | number)[];
	nestedThought: ThoughtNested;
}> => {
	let citedIds = getIds(thought.body || '');
	let byMss = [thought.by_ms];
	let children: ThoughtNested[] = await Promise.all(
		(await getThoughtChildren(getId(thought))).map(async (t) => {
			let exp = await expandThought(t);
			citedIds.push(...exp.citedIds);
			byMss.push(...exp.byMss);
			return exp.nestedThought;
		}),
	);
	return {
		citedIds,
		byMss,
		nestedThought: { ...thought, ...(children.length ? { children } : {}) },
	};
};

export let rootsPerLoad = 15;

export let loadThoughts = async (q: Parameters<typeof _loadThoughts>[0]) => _loadThoughts(q);

export let _loadThoughts = async (q: {
	rpc?: boolean;
	spaceMs?: number;
	nested?: boolean;
	oldestFirst?: boolean; // TODO: implementing this will require more data analyzing to ensure the right fromMs is sent. e.g. What to do when appending a new thought to an oldest first feed and the newest thoughts haven't been fetched yet?
	fromMs: number;
	thoughtsBeyond?: number;
	idsInclude?: string[];
	idsExclude?: string[];
	byMssInclude?: number[];
	byMssExclude?: number[];
	tagsInclude?: string[];
	tagsExclude?: string[];
	bodyIncludes?: string[];
	bodyExcludes?: string[];
}) => {
	let {
		rpc = false,
		spaceMs,
		nested = false,
		oldestFirst = false,
		fromMs,
		idsInclude = [],
		idsExclude = [],
		byMssInclude = [],
		byMssExclude = [],
		tagsInclude = [],
		tagsExclude = [],
		bodyIncludes = [],
		bodyExcludes = [],
	} = q;
	if (spaceMs === undefined) {
		// TODO: query local sqlite db
	} else {
		// TODO: query Turso db
	}

	let idsExcludeSet = new Set(idsExclude);
	let db = await gsdb();
	let roots: ThoughtNested[] = [];
	let byMss: (null | number)[] = [];
	let toIds: string[] = [];
	let citedIds: string[] = [];
	let auxThoughts: Record<string, ThoughtSelect> = {};
	let baseFilters = [
		isNotNull(thoughtsTable.ms),
		// ...(spaceMs === undefined ? [] : [isNotNull(thoughtsTable.by_ms)]),
		(oldestFirst ? gte : lte)(thoughtsTable.ms, fromMs),
		// not(like(thoughtsTable.tags, `%" private"%`)),
		or(...idsInclude.map((id) => filterId(id))),
		or(...byMssInclude.map((id) => eq(thoughtsTable.by_ms, id))),
		or(...tagsInclude.map((tag) => like(thoughtsTable.tags, `%"${tag}"%`))),
		or(...bodyIncludes.map((term) => like(thoughtsTable.body, `%${term}%`))),
		...idsExclude.map((id) => {
			let filter = filterId(id);
			return filter ? not(filter) : undefined;
		}),
		...byMssExclude.map((id) => not(eq(thoughtsTable.by_ms, id))),
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
				byMss.push(...et.byMss);
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
					byMss.push(auxThoughts[id].by_ms);
				}
			});
		}),
	);
	// await Promise.all(
	// 	[...new Set(byMss)].map((id) => {
	// 		if (id) return getThought().then((a) => a && (authors[id] = a));
	// 	}),
	// );

	return { roots, auxThoughts };
};
