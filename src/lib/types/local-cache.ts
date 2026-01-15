import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import { gs } from '../global-state.svelte';
import { m } from '../paraglide/messages';
import { getDefaultAccount, MyAccountSchema, type MyAccount } from './accounts';
import { getWhoObj } from './parts';
import { normalizeTags } from './posts';

let localCacheLocalStorageKey = 'mindappLocalCache';

export let LocalCacheSchema = z
	.object({
		currentSpaceMs: z.number(),
		accounts: z.array(MyAccountSchema),
	})
	.strict();

export type LocalCache = z.infer<typeof LocalCacheSchema>;

let getDefaultLocalCache = () =>
	structuredClone({
		currentSpaceMs: 0,
		accounts: [getDefaultAccount()],
	} satisfies LocalCache);

export let getLocalCache = () => {
	let localCache: LocalCache;
	try {
		let lcStr = localStorage.getItem(localCacheLocalStorageKey);
		localCache = lcStr ? JSON.parse(lcStr) : getDefaultLocalCache();
	} catch (error) {
		localCache = getDefaultLocalCache();
		localStorage.setItem(localCacheLocalStorageKey, JSON.stringify(localCache));
	}
	let parse = LocalCacheSchema.safeParse(localCache);
	if (!parse.success) {
		parse.error?.issues.forEach((issue) => {
			console.log(`Key: ${issue.path.join('.')}, Message: ${issue.message}`);
		});
		let ok = confirm(m.invalidLocalCacheReset());
		if (ok) {
			localCache = getDefaultLocalCache();
			localStorage.setItem(localCacheLocalStorageKey, JSON.stringify(localCache));
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
		localStorage.setItem(localCacheLocalStorageKey, JSON.stringify(newLocalCache));
	}
};

// TODO: debounce
export let updateSavedTags = async (tags: string[], remove = false) => {
	await updateLocalCache((lc) => {
		let savedTags = JSON.parse(lc.accounts[0].savedTags.txt) as string[];
		lc.accounts[0].savedTags.txt = JSON.stringify(
			remove
				? savedTags.filter((st) => !tags.includes(st))
				: normalizeTags([...savedTags, ...tags]),
		);
		return lc;
	});

	if (gs.accounts?.[0].ms) {
		let res = await trpc().updateSavedTags.mutate({
			...(await getWhoObj()),
			tags,
			remove,
		});
		await updateLocalCache((lc) => {
			lc.accounts[0].savedTags.ms = res.ms;
			return lc;
		});
	}
};

export let refreshSignedInAccounts = async () => {
	if (!gs.accounts) throw new Error(`gs.accounts dne`);
	let oldSignedInAccountMss = gs.accounts.filter((a) => a.signedIn).map((a) => a.ms);
	let currentAccountMs = oldSignedInAccountMss[0];
	let currentAccountUpdates: undefined | Partial<MyAccount>;
	let signedInAccountMss: number[] = [];
	if (oldSignedInAccountMss.length) {
		let res = await trpc().refreshSignedInAccounts.query({
			...(await getWhoObj()),
			callerTimestamps: {
				email: gs.accounts[0].email,
				name: gs.accounts[0].name,
				bio: gs.accounts[0].bio,
				savedTags: gs.accounts[0].savedTags,
				// spaceMssMs: gs.accounts[0].spaceMssMs || 0,
			},
			accountMss: oldSignedInAccountMss,
		});
		currentAccountUpdates = res.currentAccountUpdates;
		signedInAccountMss = res.signedInAccountMss || [];
	}
	if (gs.accounts[0].ms === currentAccountMs && currentAccountUpdates) {
		updateLocalCache((lc) => {
			lc.accounts[0] = {
				...lc.accounts[0],
				...currentAccountUpdates,
			};
			return lc;
		});
	}
	updateLocalCache((lc) => ({
		...lc,
		accounts: lc.accounts.map((a) => ({
			...a,
			signedIn: signedInAccountMss.includes(a.ms),
		})),
	}));
	updateLocalCache((lc) => ({
		...lc,
		accounts: lc.accounts.sort((a, b) => {
			if (a.signedIn && b.signedIn) return 0;
			if (a.signedIn && !b.signedIn) return -1;
			if (!a.signedIn && b.signedIn) return 1;
			if (!a.ms && b.ms) return -1;
			if (a.ms && !b.ms) return 1;
			return 0;
		}),
	}));
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
