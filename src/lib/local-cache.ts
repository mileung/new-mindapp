import { z } from 'zod';
import { SpaceSchema } from './spaces';
import { AccountSchema, type Account } from './accounts';
import { filterId, filterThought, type ThoughtInsert } from './thoughts';
import { and, eq, isNull } from 'drizzle-orm';
import { m } from './paraglide/messages';
import { gs } from './global-state.svelte';
import { thoughtsTable } from './thoughts-table';
import { gsdb } from './local-db';

export let LocalCacheSchema = z
	.object({
		spaces: z.record(z.number(), SpaceSchema),
		accounts: z.array(AccountSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

export let defaultLocalCache: LocalCache = {
	spaces: {},
	accounts: [
		{
			ms: '',
			currentSpaceMs: '',
			spacesPinnedThrough: 0,
			spaceMss: [
				'', // local space id - everything local
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
		by_ms: 0,
		tags: [' local-cache'],
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

let localCacheFilter = filterThought({
	by_ms: 0, // When by_ms === 0, that's a system thought.
	tags: [' local-cache'],
});

export async function getLocalCache() {
	let [localCacheRow] = await (await gsdb()).select().from(thoughtsTable).where(localCacheFilter);
	if (!localCacheRow) localCacheRow = await initLocalCache();
	let localCache: LocalCache = JSON.parse(localCacheRow.body!);
	if (!LocalCacheSchema.safeParse(localCache).success) {
		throw new Error('Invalid localCache');
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
	await (await gsdb())
		.update(thoughtsTable)
		.set(makeLocalCacheThoughtInsert(newLocalCache))
		.where(localCacheFilter);
}

export async function deleteLocalCache() {
	await (await gsdb()).delete(thoughtsTable).where(localCacheFilter);
}
