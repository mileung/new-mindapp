import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import { alertError } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import { getWhoObj, gs } from '../global-state.svelte';
import { m } from '../paraglide/messages';
import { getDefaultAccount, MyAccountSchema } from './accounts';
import { normalizeTags } from './posts';
import { accentCodes, getDefaultSpace, permissionCodes, roleCodes, SpaceSchema } from './spaces';

let localCacheLocalStorageKey = 'mindappLocalCache';

export let LocalCacheSchema = z
	.strictObject({
		devMode: z.boolean(),
		lastSeenInMs: z.number(),
		accounts: z.array(MyAccountSchema),
		msToSpaceMap: z.record(z.string(), SpaceSchema.optional()),
	})
	.refine((lc) => {
		let hasLocalSpace = '0' in lc.msToSpaceMap;
		let uniqueJoinedSpaceContextMss = true;
		let hasAnonAccount = false;
		let uniqueAccountMss =
			lc.accounts.length ===
			[
				...new Set(
					lc.accounts.map((a) => {
						if (!a.ms) hasAnonAccount = true;
						uniqueJoinedSpaceContextMss =
							a.joinedSpaceContexts.length ===
							[...new Set(a.joinedSpaceContexts.map((c) => c.ms))].length;
						return a.ms;
					}),
				),
			].length;

		return (
			hasLocalSpace && //
			uniqueJoinedSpaceContextMss &&
			hasAnonAccount &&
			uniqueAccountMss
		);
	});

export type LocalCache = z.infer<typeof LocalCacheSchema>;

let getDefaultLocalCache = () =>
	structuredClone({
		devMode: dev,
		lastSeenInMs: 0,
		accounts: [getDefaultAccount()],
		msToSpaceMap: { 0: getDefaultSpace() },
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

export let updateSavedTags = async (usedTags: string[], remove = false) => {
	// TODO: debounce
	let savedTags = JSON.parse(gs.accounts![0].savedTags.txt) as string[];
	savedTags = remove
		? savedTags.filter((t) => !usedTags.includes(t))
		: normalizeTags([...savedTags, ...usedTags]);
	try {
		let ms = gs.accounts?.[0].ms
			? (
					await trpc().updateSavedTags.mutate({
						...(await getWhoObj()),
						savedTags,
					})
				).ms
			: 0;
		updateLocalCache((lc) => {
			lc.accounts[0].savedTags.txt = JSON.stringify(savedTags);
			if (ms) lc.accounts[0].savedTags.ms = ms;
			return lc;
		});
	} catch (error) {
		alertError(error);
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
			let { redeemMs: ms } = await trpc().checkInvite.mutate({
				...(await getWhoObj()),
				inviteMs: gs.checkedInvite.ms,
				slugEnd: gs.checkedInvite.slugEnd,
				useIfValid: true,
			});
			if (!ms) return alert(m.invalidInvite());
			let joinedSpaceMs = gs.checkedInvite.partialSpace.ms;
			updateLocalCache((lc) => {
				lc.accounts[0].joinedSpaceContexts.unshift({
					ms: joinedSpaceMs, // below is just placeholder data getCallerContext will update
					roleCode: { ms, num: roleCodes.member },
					permissionCode: { ms, num: permissionCodes.reactAndPost },
					flair: { ms, txt: '' },
					accentCode: { ms, num: accentCodes.none },
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
