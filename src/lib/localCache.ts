import { z } from 'zod';
import { SpaceSchema } from './spaces';
import { PersonaSchema } from './accounts';
import { getIdFilter, gsdb, thoughtsTable, type ThoughtInsert } from './thoughts';
import { and, isNull } from 'drizzle-orm';
import { m } from './paraglide/messages';
import { gs } from './globalState.svelte';

export let LocalCacheSchema = z
	.object({
		spaces: z.record(z.number(), SpaceSchema),
		accounts: z.array(PersonaSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

export let defaultLocalCache: LocalCache = {
	spaces: {},
	accounts: [
		{
			id: '',
			currentSpaceId: '',
			spacesPinnedThrough: 0,
			// sequentialSpaceIds:[],
			spaceIds: [
				'', // local space id - everything local
				'0', // personal space id - everything private in cloud
				'1', // global space id - everything public in cloud
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
				getIdFilter('__'),
			),
		);
	if (!localCacheRow) localCacheRow = await initLocalCache();
	let localCache: LocalCache = JSON.parse(localCacheRow.body!);
	if (!LocalCacheSchema.safeParse(localCache).success) {
		window.alert(m.resettingInvalidLocalCache());
		await deleteLocalCache();
		localCacheRow = await initLocalCache();
		localCache = JSON.parse(localCacheRow.body!);
	}
	return localCache;
}

export async function updateLocalCache(updater: (old: LocalCache) => LocalCache) {
	let pseudoOldLC = {
		accounts: gs.accounts,
		spaces: gs.spaces,
	} as LocalCache;
	let pseudoNewLC = updater(pseudoOldLC);
	gs.accounts = pseudoNewLC.accounts;
	gs.spaces = pseudoNewLC.spaces;
	// The above is to hide the delay of fetching the local cache

	let oldLocalCache = await getLocalCache();
	let newLocalCache = updater(oldLocalCache);

	if (!LocalCacheSchema.safeParse(newLocalCache).success) {
		return window.alert(m.invalidLocalCacheUpdate());
	}

	gs.accounts = newLocalCache.accounts;
	gs.spaces = newLocalCache.spaces;
	await (
		await gsdb()
	)
		.update(thoughtsTable)
		.set(makeLocalCacheThoughtInsert(newLocalCache))
		.where(and(isNull(thoughtsTable.tags), isNull(thoughtsTable.to_id), getIdFilter('__')));
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
