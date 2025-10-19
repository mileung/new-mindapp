import { dev } from '$app/environment';
import { trpc } from '$lib/trpc/client';
import type { GetFeedInput, GetFeedOutput } from '$lib/trpc/router';
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
import { sortUniArr } from '../js';
import { gsdb } from '../local-db';
import { thoughtsTable } from './thoughts-table';

export type ThoughtInsert = typeof thoughtsTable.$inferInsert;
export type ThoughtSelect = typeof thoughtsTable.$inferSelect;
export type ThoughtNested = ThoughtInsert & { children?: ThoughtNested[]; childIds?: string[] };
export let ThoughtInsertSchema = createInsertSchema(thoughtsTable);
export let ThoughtSelectSchema = createSelectSchema(thoughtsTable);

type IdSegments = Pick<ThoughtInsert, 'ms' | 'by_ms' | 'in_ms'>;
export let getId = (thought: IdSegments) =>
	`${thought.ms ?? ''}_${thought.by_ms ?? ''}_${thought.in_ms ?? ''}`;

export let bracketRegex = /\[([^\[\]]+)]/g;
export let idRegex = /^\d*_\d*_\d*$/;
export let idsRegex = /(^|\s)\d*_\d*_\d*($|\s)/g;

export let isId = (str = '') => idRegex.test(str);

export let getIds = (str = '') => [...str.matchAll(idsRegex)].map((match) => match[0].trim());

export function splitId(id: string) {
	let s = id.split('_', 3);
	return { ms: s[0] || '', by_ms: s[1] || '', in_ms: s[2] || '' };
}

// let systemTags = new Set([' edited:<ms>', ' deleted']);
export function divideTags(thought: ThoughtInsert) {
	let authorTags: string[] = [];
	let systemTags: string[] = [];
	(thought.tags || []).forEach((t) => (t[0] === ' ' ? systemTags : authorTags).push(t));
	return { authorTags, systemTags };
}

export let filterId = (id: string) => {
	let { ms, by_ms, in_ms } = splitId(id);
	return filterThought({
		ms: ms === '' ? null : +ms,
		by_ms: by_ms === '' ? null : +by_ms,
		in_ms: in_ms === '' ? null : +in_ms,
	});
};

export let filterThought = (t: ThoughtInsert) => {
	return and(
		typeof t.ms === 'number' ? eq(thoughtsTable.ms, t.ms) : isNull(thoughtsTable.ms),
		typeof t.by_ms === 'number' ? eq(thoughtsTable.by_ms, t.by_ms) : isNull(thoughtsTable.by_ms),
		typeof t.in_ms === 'number' ? eq(thoughtsTable.in_ms, t.in_ms) : isNull(thoughtsTable.in_ms),
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

type Database = LibSQLDatabase<any> | SqliteRemoteDatabase;

export let insertLocalThought = async (t: ThoughtInsert) => {
	(await gsdb()).insert(thoughtsTable).values(t);
};

export let overwriteLocalThought = async (t: ThoughtInsert) => {
	await (await gsdb()).update(thoughtsTable).set(t).where(filterThought(t));
};

export let addThought = async (t: ThoughtInsert, useRpc: boolean) => {
	return useRpc ? trpc().addThought.mutate(t) : _addThought(await gsdb(), t);
};

export let _addThought = async (db: Database, t: ThoughtInsert) => {
	console.log('_addThought');
	if (typeof t.in_ms === 'number') {
		if (!t.by_ms) throw new Error('Missing by_ms');
	}
	if (!(t.tags || []).every((t) => t.length === t.trim().length))
		throw new Error('Every tag must be trimmed');
	let ms = Date.now();
	// gs.accounts[0].currentSpaceMs
	await db.insert(thoughtsTable).values({ ...t, ms });
	return ms;
};

export let _getThoughtById = async (
	db: Database,
	id: string,
): Promise<ThoughtSelect | undefined> => {
	return (await db.select().from(thoughtsTable).where(filterId(id)).limit(1))[0];
};

export let editThought = async (t: ThoughtInsert, useRpc: boolean) => {
	return useRpc ? trpc().editThought.mutate(t) : _editThought(await gsdb(), t);
};

export let _editThought = async (db: Database, t: ThoughtInsert) => {
	if (!t.ms) throw new Error('Missing ms');
	if (t.tags?.[0] === ' deleted') throw new Error('Cannot edit deleted thoughts');
	if (typeof t.in_ms === 'number') {
		if (!t.by_ms) throw new Error('Missing by_ms');
		// TODO: Verify user by_ms is logged and has access to space in_ms
	}
	let originalThought = await _getThoughtById(db, getId(t));
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
	await db
		.update(thoughtsTable)
		.set({ ...t, tags })
		.where(filterThought(t));
	return tags;
};

// export async function updateThought(id: string) {}

// TODO: paginate children when there's too many with fromMs
// Reddit does this - HN does not
let _getThoughtChildren = async (db: Database, id: string, limit = -1) => {
	let children = await db
		.select()
		.from(thoughtsTable)
		.where(eq(thoughtsTable.to_id, id))
		.orderBy(desc(thoughtsTable.ms))
		.limit(limit);
	return children;
};

export let deleteThought = async (id: string, useRpc: boolean) => {
	return useRpc ? trpc().deleteThought.mutate(id) : _deleteThought(await gsdb(), id);
};

export let _deleteThought = async (db: Database, id: string) => {
	let s = splitId(id);
	if (s.in_ms) {
		if (!s.by_ms) throw new Error('Missing by_ms');
		// TODO: Verify user by_ms is logged and has access to space in_ms
	}
	if ((await _getThoughtChildren(db, id, 1)).length) {
		await db
			.update(thoughtsTable)
			.set({
				body: null,
				tags: [' deleted'],
			})
			.where(filterId(id));
		return { soft: true };
	} else {
		await db.delete(thoughtsTable).where(filterId(id));
		return { soft: false };
	}
};

let _getRootThought = async (db: Database, thought: ThoughtSelect) => {
	let rootThought = thought;
	// let interThoughts: Record<string, ThoughtSelect> = {};
	while (rootThought?.to_id) {
		// interThoughts[getId(thought)] = rootThought;
		let toThought = await _getThoughtById(db, rootThought.to_id);
		if (toThought) rootThought = toThought;
	}
	return {
		rootThought,
		// TODO: maybe make loading thoughts more efficient by not getting rows that have already been gotten?
		// interThoughts
	};
};

let _expandThought = async (
	db: Database,
	thought: ThoughtSelect,
): Promise<{
	citedIds: string[];
	byMss: (null | number)[];
	nestedThought: ThoughtNested;
}> => {
	let citedIds = getIds(thought.body || '');
	let byMss = [thought.by_ms];
	let children: ThoughtNested[] = await Promise.all(
		(await _getThoughtChildren(db, getId(thought))).map(async (t) => {
			let exp = await _expandThought(db, t);
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

export let getFeed = async (q: Parameters<typeof _getFeed>[1]) => {
	// TODO: Search local and global spaces in one query
	return q.useRpc ? trpc().getFeed.mutate(q) : _getFeed(await gsdb(), q);
};

export let _getFeed = async (db: Database, q: GetFeedInput): Promise<GetFeedOutput> => {
	let idsExcludeSet = new Set(q.idsExclude);
	let roots: ThoughtNested[] = [];
	let byMss: (null | number)[] = [];
	let toIds: string[] = [];
	let citedIds: string[] = [];
	let auxThoughts: Record<string, ThoughtSelect> = {};

	// console.log('q.inMssInclude:', q.inMssInclude);
	if (q.useRpc && !q.inMssInclude?.length) throw new Error('Must include at least one inMs');

	let andConditions = [
		isNotNull(thoughtsTable.ms),
		...(q.useRpc ? [isNotNull(thoughtsTable.by_ms), isNotNull(thoughtsTable.in_ms)] : []),
		(q.oldestFirst ? gte : lte)(thoughtsTable.ms, q.fromMs),

		or(
			...(q.inMssInclude || []).map((ms) =>
				ms === ''
					? q.useRpc
						? (() => {
								throw new Error('inMss cannot include "" when useRpc');
							})()
						: isNull(thoughtsTable.in_ms)
					: !ms
						? and(
								eq(thoughtsTable.in_ms, 0),
								eq(
									thoughtsTable.by_ms,
									q.callerMs ||
										(() => {
											throw new Error('Missing callerMs');
										})(),
								),
							)
						: eq(thoughtsTable.in_ms, ms),
			),
		),

		or(...(q.idsInclude || []).map((id) => filterId(id))),
		...(q.idsExclude || []).map((id) => {
			let filter = filterId(id);
			return filter ? not(filter) : undefined;
		}),

		or(
			...(q.byMssInclude || []).map((ms) =>
				ms === '' ? isNull(thoughtsTable.by_ms) : eq(thoughtsTable.by_ms, ms),
			),
		),

		...(q.byMssExclude || []).map((ms) =>
			ms === '' ? isNotNull(thoughtsTable.ms) : not(eq(thoughtsTable.by_ms, ms)),
		),

		or(...(q.tagsInclude || []).map((tag) => like(thoughtsTable.tags, `%"${tag}"%`))),
		...(q.tagsExclude || []).map((tag) => notLike(thoughtsTable.tags, `%"${tag}"%`)),

		or(...(q.bodyIncludes || []).map((term) => like(thoughtsTable.body, `%${term}%`))),
		...(q.bodyExcludes || []).map((term) => notLike(thoughtsTable.body, `%${term}%`)),
	];

	// console.log('q:', q);
	if (q.nested) {
		let offset = 0;
		while (true) {
			let [currentRow] = await db
				.select()
				.from(thoughtsTable)
				.where(and(...andConditions))
				.orderBy((q.oldestFirst ? asc : desc)(thoughtsTable.ms))
				.limit(1)
				.offset(offset++);
			if (!currentRow) break;
			let {
				rootThought, //interThoughts
			} = await _getRootThought(db, currentRow);

			// console.log('currentRow:', currentRow);

			if (
				!idsExcludeSet.has(getId(rootThought)) &&
				!roots.find((root) => getId(root) === getId(rootThought))
			) {
				let et = await _expandThought(db, rootThought);
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
			.where(and(...andConditions))
			.orderBy((q.oldestFirst ? asc : desc)(thoughtsTable.ms))
			.limit(rootsPerLoad);

		// TODO: I shouldn't have to add a bang to r.to_id!. TypeScript bug? Don't want to use typeof i==='string' in filter
		toIds = roots.map((r) => r.to_id!).filter((i) => !!i);
		citedIds = roots.flatMap((r) =>
			[...(r.body || '').matchAll(idsRegex)].map((m) => m[0].trim()).filter((i) => !!i),
		);
	}

	await Promise.all(
		[...new Set([...citedIds, ...(q.nested ? toIds : [])])].map((id) => {
			return _getThoughtById(db, id).then((thought) => {
				if (thought) {
					auxThoughts[id] = thought;
					byMss.push(auxThoughts[id].by_ms);
				}
			});
		}),
	);
	// await Promise.all(
	// 	[...new Set(byMss)].map((id) => {
	// 		if (id) return getThoughtById().then((a) => a && (authors[id] = a));
	// 	}),
	// );

	return { roots, auxThoughts };
};
