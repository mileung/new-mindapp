import { z } from 'zod';
import { SpaceSchema } from './spaces';
import { PersonaSchema } from './personas';
import { filterThoughtId, gsdb, thoughtsTable, type ThoughtInsert } from './thoughts';
import { and, isNull } from 'drizzle-orm';
import { m } from './paraglide/messages';

export let LocalCacheSchema = z
	.object({
		spaces: z.record(z.number(), SpaceSchema),
		personas: z.array(PersonaSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

export let defaultLocalCache: LocalCache = {
	spaces: {},
	personas: [
		{
			id: undefined,
			spaceIds: [
				undefined, // local space id - everything local
				0, // personal space id - everything private in cloud
				1, // global space id - everything public in cloud
				// users can make additional spaces with custom privacy
			],
			tags: [],
		},
	],
};

let makeLocalCacheThoughtInsert = (localCache: LocalCache) =>
	({
		ms: undefined,
		tags: undefined,
		by_id: undefined,
		to_id: undefined,
		in_id: undefined,
		body: JSON.stringify(localCache),
	}) as ThoughtInsert;
export async function initLocalCache() {
	return (
		await (await gsdb())
			.insert(thoughtsTable)
			.values(makeLocalCacheThoughtInsert(defaultLocalCache))
			.returning()
	)[0];
}

export async function getLocalCache() {
	let [localCacheRow] = await (
		await gsdb()
	)
		.select()
		.from(thoughtsTable)
		.where(
			and(
				// Not sure if I'll use tags or to_id to organize multiple author-less meta thoughts...
				isNull(thoughtsTable.tags),
				isNull(thoughtsTable.to_id),
				filterThoughtId({}),
			),
		);
	if (!localCacheRow) localCacheRow = await initLocalCache();
	let localCache: LocalCache = JSON.parse(localCacheRow.body!);
	if (!LocalCacheSchema.safeParse(localCache)) {
		window.alert(m.invalidLocalCache());
		await deleteLocalCache();
		localCacheRow = await initLocalCache();
		localCache = JSON.parse(localCacheRow.body!);
	}
	return localCache;
}

export async function updateLocalCache(updatedLocalCache: LocalCache) {
	if (!LocalCacheSchema.safeParse(updatedLocalCache)) {
		return window.alert(m.invalidLocalCacheUpdate());
	}
	await (
		await gsdb()
	)
		.update(thoughtsTable)
		.set(makeLocalCacheThoughtInsert(updatedLocalCache))
		.where(and(isNull(thoughtsTable.tags), isNull(thoughtsTable.to_id), filterThoughtId({})));
}

export async function deleteLocalCache() {
	await (await gsdb())
		.delete(thoughtsTable)
		.where(
			and(
				isNull(thoughtsTable.ms),
				isNull(thoughtsTable.tags),
				isNull(thoughtsTable.by_id),
				isNull(thoughtsTable.to_id),
				isNull(thoughtsTable.in_id),
			),
		);
}
