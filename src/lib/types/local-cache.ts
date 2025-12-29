import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import { gs } from '../global-state.svelte';
import { m } from '../paraglide/messages';
import { getDefaultAccount, MyAccountSchema } from './accounts';
import { getWhoObj } from './parts';
import { normalizeTags } from './posts';
import { SpaceSchema } from './spaces';

let lcKey = 'localCache';

export let LocalCacheSchema = z
	.object({
		currentSpaceMs: z.number(),
		msToSpaceMap: z.record(z.number(), SpaceSchema.optional()),
		accounts: z.array(MyAccountSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

let getDefaultLocalCache = () =>
	structuredClone({
		currentSpaceMs: 0,
		msToSpaceMap: {},
		accounts: [getDefaultAccount()],
	} satisfies LocalCache);

export let getLocalCache = () => {
	let localCache: LocalCache;
	try {
		let lcStr = localStorage.getItem(lcKey);
		localCache = lcStr ? JSON.parse(lcStr) : getDefaultLocalCache();
	} catch (error) {
		localCache = getDefaultLocalCache();
		localStorage.setItem(lcKey, JSON.stringify(localCache));
	}
	let parse = LocalCacheSchema.safeParse(localCache);
	if (!parse.success) {
		parse.error?.issues.forEach((issue) => {
			console.log(`Key: ${issue.path.join('.')}, Message: ${issue.message}`);
		});
		let ok = confirm(m.invalidLocalCacheReset());
		if (ok) {
			localCache = getDefaultLocalCache();
			localStorage.setItem(lcKey, JSON.stringify(localCache));
		}
	}
	return localCache;
};

export let updateLocalCache = async (updater: (old: LocalCache) => LocalCache) => {
	if (gs.accounts) {
		let oldLocalCache = getLocalCache();
		let newLocalCache = updater(oldLocalCache);
		let parse = LocalCacheSchema.safeParse(newLocalCache);
		if (!parse.success) {
			parse.error?.issues.forEach((issue) => {
				console.warn(`Key: ${issue.path.join('.')}, Message: ${issue.message}`);
			});
			throw new Error('Invalid local cache update');
		}
		gs.currentSpaceMs = newLocalCache.currentSpaceMs;
		gs.accounts = newLocalCache.accounts;
		gs.msToSpaceMap = newLocalCache.msToSpaceMap;
		localStorage.setItem(lcKey, JSON.stringify(newLocalCache));
	}
};

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
			...(await getWhoObj()),
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
		let res = await trpc().getMyAccountUpdates.query({
			...(await getWhoObj()),
			emailMs: gs.accounts[0].emailMs || 0,
			nameMs: gs.accounts[0].nameMs || 0,
			bioMs: gs.accounts[0].bioMs || 0,
			savedTagsMs: gs.accounts[0].savedTagsMs || 0,
			spaceMssMs: gs.accounts[0].spaceMssMs || 0,
		});
		updateLocalCache((lc) => {
			lc.accounts[0] = {
				...lc.accounts[0],
				...res,
			};
			return lc;
		});
	}
};

export let unsaveAccount = (accountMs: number) => {
	updateLocalCache((lc) => ({
		...lc,
		accounts: [...lc.accounts.filter((acc) => acc.ms !== accountMs)],
	}));
};

export let signOut = async (callerMs: number, allCallerMsSessions = false) => {
	try {
		await trpc().signOut.mutate({
			callerMs,
			everywhere: allCallerMsSessions,
		});
	} catch (error) {}
	unsaveAccount(callerMs);
};
