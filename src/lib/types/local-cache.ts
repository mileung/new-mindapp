import { sortUniArr } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { gs } from '../global-state.svelte';
import { gsdb } from '../local-db';
import { m } from '../paraglide/messages';
import { AccountSchema } from './accounts';
import { SpaceSchema } from './spaces';
import { type ThoughtInsert } from './thoughts';
import { thoughtsTable } from './thoughts-table';

export let LocalCacheSchema = z
	.object({
		currentSpaceMs: z.literal('').or(z.number()),
		spaces: z.record(z.number(), SpaceSchema.optional()),
		accounts: z.array(AccountSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

let defaultLocalCache: LocalCache = {
	currentSpaceMs: '',
	spaces: {},
	accounts: [
		{
			ms: '',
			spaceMss: [
				'', // local space id - everything local
				0, // personal space id - everything private in cloud
				1, // global space id - everything public in cloud
				// users can make additional spaces with custom privacy
			],
			allTags: [],
		},
	],
};

let makeLocalCacheThoughtInsert = (localCache: LocalCache) =>
	({
		tags: [' local-cache'],
		body: JSON.stringify(localCache),
	}) satisfies ThoughtInsert;

let localCacheRowFilter = and(
	isNull(thoughtsTable.ms),
	isNull(thoughtsTable.by_ms),
	isNull(thoughtsTable.in_ms),
	eq(thoughtsTable.tags, [' local-cache']),
);

export async function getLocalCache() {
	let [localCacheRow] = await (await gsdb())
		.select()
		.from(thoughtsTable)
		.where(localCacheRowFilter);
	if (!localCacheRow) {
		localCacheRow = (
			await (await gsdb())
				.insert(thoughtsTable)
				.values(makeLocalCacheThoughtInsert(defaultLocalCache))
				.returning()
		)[0];
	}
	let localCache: LocalCache;
	try {
		localCache = JSON.parse(localCacheRow.body!);
	} catch (error) {
		throw new Error('Invalid localCache');
	}

	if (
		!LocalCacheSchema.safeParse(localCache).success ||
		!(
			localCacheRow.tags?.length === 1 && //
			localCacheRow.tags[0] === ' local-cache'
		)
	) {
		LocalCacheSchema.safeParse(localCache).error?.issues.forEach((issue) => {
			console.log(`Key: ${issue.path.join('.')}, Message: ${issue.message}`);
		});
		throw new Error('Invalid localCache');
	}
	return localCache;
}

export async function updateLocalCache(updater: (old: LocalCache) => LocalCache) {
	if (gs.accounts) {
		let pseudoOldLC = {
			currentSpaceMs: gs.currentSpaceMs,
			accounts: gs.accounts,
			spaces: gs.spaces,
		} satisfies LocalCache;
		let pseudoNewLC = updater(pseudoOldLC);
		gs.currentSpaceMs = pseudoNewLC.currentSpaceMs;
		gs.accounts = pseudoNewLC.accounts;
		gs.spaces = pseudoNewLC.spaces;
		// The above is to hide the delay of fetching the local cache

		let oldLocalCache = await getLocalCache();
		let newLocalCache = updater(oldLocalCache);

		if (!LocalCacheSchema.safeParse(newLocalCache).success) {
			return window.alert(m.invalidLocalCacheUpdate());
		}

		gs.currentSpaceMs = newLocalCache.currentSpaceMs;
		gs.accounts = newLocalCache.accounts;
		gs.spaces = newLocalCache.spaces;
		await (await gsdb())
			.update(thoughtsTable)
			.set(makeLocalCacheThoughtInsert(newLocalCache))
			.where(localCacheRowFilter);
	}
}

export async function deleteLocalCache() {
	await (await gsdb()).delete(thoughtsTable).where(localCacheRowFilter);
}

export let unsaveTagInCurrentAccount = async (tag: string) => {
	await updateLocalCache((lc) => {
		lc.accounts[0].allTags = sortUniArr([...lc.accounts[0].allTags].filter((t) => t !== tag));
		return lc;
	});
	await updateAllTagsMs({ adding: [], removing: [tag] });
};

export let updateAllTagsMs = async (update: { adding: string[]; removing: string[] }) => {
	if (gs.accounts?.[0].ms) {
		let res = await trpc().updateAllTags.mutate({
			...update,
			callerMs: gs.accounts[0].ms,
		});
		await updateLocalCache((lc) => {
			lc.accounts[0].allTagsMs = res.ms;
			let removingSet = new Set(update.removing);
			lc.accounts[0].allTags = sortUniArr([...lc.accounts[0].allTags, ...update.adding]).filter(
				(t) => !removingSet.has(t),
			);
			return lc;
		});
	}
};

export let getLatestAllTags = async () => {
	if (gs.accounts?.[0].ms) {
		let res = await trpc().getAllTags.query({
			allTagsMs: gs.accounts[0].allTagsMs,
			callerMs: gs.accounts[0].ms,
		});
		if (res) {
			updateLocalCache((lc) => {
				lc.accounts[0] = {
					...lc.accounts[0],
					...res,
				};
				return lc;
			});
		}
	}
};
