import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import { gs } from '../global-state.svelte';
import { m } from '../paraglide/messages';
import { AccountSchema, getDefaultAccount } from './accounts';
import { getBaseInput } from './parts';
import { normalizeTags } from './posts';
import { SpaceSchema } from './spaces';

let lcKey = 'localCache';

export let LocalCacheSchema = z
	.object({
		currentSpaceMs: z.number(),
		spaces: z.record(z.number(), SpaceSchema.optional()),
		accounts: z.array(AccountSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

let getDefaultLocalCache = () =>
	structuredClone({
		currentSpaceMs: 0,
		spaces: {},
		accounts: [getDefaultAccount()],
	} satisfies LocalCache);

export function getLocalCache() {
	let localCache: LocalCache;
	try {
		let lcStr = localStorage.getItem(lcKey);
		localCache = lcStr ? JSON.parse(lcStr) : getDefaultLocalCache();
	} catch (error) {
		localCache = getDefaultLocalCache();
		localStorage.setItem(lcKey, JSON.stringify(localCache));
	}

	if (!LocalCacheSchema.safeParse(localCache).success) {
		LocalCacheSchema.safeParse(localCache).error?.issues.forEach((issue) => {
			console.log(`Key: ${issue.path.join('.')}, Message: ${issue.message}`);
		});
		let ok = confirm(m.invalidLocalCacheReset());
		if (ok) {
			localCache = getDefaultLocalCache();
			localStorage.setItem(lcKey, JSON.stringify(localCache));
		}
	}
	return localCache;
}

export async function updateLocalCache(updater: (old: LocalCache) => LocalCache) {
	if (gs.accounts) {
		let oldLocalCache = getLocalCache();
		let newLocalCache = updater(oldLocalCache);
		if (!LocalCacheSchema.safeParse(newLocalCache).success) {
			// return window.alert(m.invalidLocalCacheUpdate());
			throw new Error(m.invalidLocalCacheUpdate());
		}
		gs.currentSpaceMs = newLocalCache.currentSpaceMs;
		gs.accounts = newLocalCache.accounts;
		gs.idToSpaceMap = newLocalCache.spaces;
		localStorage.setItem(lcKey, JSON.stringify(newLocalCache));
	}
}

// TODO: debounce
export let updateSavedTags = async (tags: string[], remove = false) => {
	await updateLocalCache((lc) => {
		lc.accounts[0].savedTags = remove
			? lc.accounts[0].savedTags.filter((st) => !tags.includes(st))
			: normalizeTags([...lc.accounts![0].savedTags, ...tags]);
		return lc;
	});

	if (gs.accounts?.[0].ms) {
		let res = await trpc().updateSavedTags.mutate({
			...(await getBaseInput()),
			tags,
			remove,
		});
		await updateLocalCache((lc) => {
			lc.accounts[0].savedTagsMs = res.savedTagsMs;
			return lc;
		});
	}
};

export let refreshCurrentAccount = async () => {
	if (gs.accounts?.[0].ms) {
		// let res = await trpc().getAccountByMs.query({
		// 	byMs: gs.accounts[0].ms,
		// 	inMs:0,
		// 	// spaceMssMs: gs.accounts[0].spaceMssMs,
		// 	// savedTagsMs: gs.accounts[0].savedTagsMs,
		// 	// emailMs: gs.accounts[0].emailMs,
		// 	// nameMs: gs.accounts[0].nameMs,
		// });
		// if (res) {
		// 	updateLocalCache((lc) => {
		// 		lc.accounts[0] = {
		// 			...lc.accounts[0],
		// 			...res,
		// 		};
		// 		return lc;
		// 	});
		// }
	}
};
