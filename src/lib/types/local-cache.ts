import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import { alertError } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import { getWhoObj, gs } from '../global-state.svelte';
import { m } from '../paraglide/messages';
import { getDefaultAccount, MyAccountSchema } from './accounts';
import { normalizeTags } from './posts';
import { accentCodes, permissionCodes, roleCodes, SpaceSchema } from './spaces';

let localCacheLocalStorageKey = 'mindappLocalCache';

export let LocalCacheSchema = z.strictObject({
	devMode: z.boolean(),
	lastSeenInMs: z.number(),
	accounts: z.array(MyAccountSchema),
	msToSpaceMap: z.record(z.string(), SpaceSchema.optional()),
});

export type LocalCache = z.infer<typeof LocalCacheSchema>;

let getDefaultLocalCache = () =>
	structuredClone({
		devMode: dev,
		lastSeenInMs: 0,
		accounts: [getDefaultAccount()],
		msToSpaceMap: {},
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

export let updateLocalCache = (updater: (old: LocalCache) => LocalCache) => {
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
		gs.devMode = newLocalCache.devMode;
		gs.lastSeenInMs = newLocalCache.lastSeenInMs;
		gs.accounts = newLocalCache.accounts;
		gs.msToSpaceMap = newLocalCache.msToSpaceMap;
		localStorage.setItem(localCacheLocalStorageKey, JSON.stringify(newLocalCache));
	}
};

export let updateSavedTags = async (tags: string[], remove = false) => {
	// TODO: debounce
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

export let unsaveAccount = (accountMs: number) => {
	updateLocalCache((lc) => ({
		...lc,
		accounts: [...lc.accounts.filter((acc) => acc.ms !== accountMs)],
	}));
};

export let signOut = async (callerMs: number, everywhere = false) => {
	try {
		await trpc().signOut.mutate({
			callerMs,
			everywhere,
		});
	} catch (error) {}
	updateLocalCache((lc) => {
		lc.accounts = lc.accounts
			.map((a) => ({
				...a,
				signedIn: a.ms === callerMs ? false : a.signedIn,
			}))
			.sort((a, b) => {
				let aPriority = !a.ms || a.signedIn ? 0 : 1;
				let bPriority = !b.ms || b.signedIn ? 0 : 1;
				return aPriority - bPriority;
			});
		return lc;
	});
	if (callerMs === gs.accounts?.[0].ms) {
		gs.urlToPostFeedMap = {};
		delete gs.accountMsToSpaceMsToCheckedMap[callerMs];
		goto(`/__${gs.lastSeenInMs}`);
	}
};

export let useCheckedInvite = async () => {
	try {
		if (gs.accounts !== undefined && gs.checkedInvite) {
			if (gs.accounts[0].ms === gs.checkedInvite.inviter.ms)
				return alert(m.cannotUseYourOwnInvite());
			let { redeemed } = await trpc().checkInvite.mutate({
				...(await getWhoObj()),
				inviteMs: gs.checkedInvite.ms,
				slugEnd: gs.checkedInvite.slugEnd,
				useIfValid: true,
			});
			if (!redeemed) return alert(m.invalidInvite());
			let joinedSpaceMs = gs.checkedInvite.partialSpace.ms;
			updateLocalCache((lc) => {
				lc.accounts[0].joinedSpaceContexts.unshift({
					ms: joinedSpaceMs, // below is just placeholder data getCallerContext will update
					accentCode: { num: accentCodes.none },
					permissionCode: { num: permissionCodes.reactAndPost },
					roleCode: { num: roleCodes.member },
				});
				return lc;
			});
			gs.accountMsToSpaceMsToCheckedMap = {
				...gs.accountMsToSpaceMsToCheckedMap,
				[gs.accounts[0].ms]: {
					...gs.accountMsToSpaceMsToCheckedMap[gs.accounts[0].ms],
					[gs.checkedInvite.partialSpace.ms]: false,
				},
			};
			gs.checkedInvite = undefined;
			goto(`/__${joinedSpaceMs}`);
		}
	} catch (error) {
		alertError(error);
	}
};
