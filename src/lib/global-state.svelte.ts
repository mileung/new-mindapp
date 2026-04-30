import { dev } from '$app/environment';
import { page } from '$app/state';
import { PUBLIC_OWNER_MSS } from '$env/static/public';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { identikana } from './js';
import { m } from './paraglide/messages';
import { getDefaultAccount, type MyAccount, type PublicProfile } from './types/accounts';
import { updateLocalCache } from './types/local-cache';
import type { WhoObj, WhoWhereObj } from './types/parts';
import { getUrlInMs, type FullIdObj } from './types/parts/partIds';
import type { Post } from './types/posts';
import {
	accentCodes,
	getDefaultSpace,
	permissionCodes,
	roleCodes,
	type Invite,
	type Membership,
	type Space,
	type SpaceContext,
} from './types/spaces';
import type { CheckedInvite } from './types/spaces/_checkInvite';

class GlobalState {
	invalidLocalCache = $state(false);
	localDbFailed = $state(false);
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	checkedInvite = $state<CheckedInvite>();
	lastScrollY = $state(0);

	// local-cache
	devMode = $state(dev);
	lastSeenInMs = $state<number>();
	accounts = $state<undefined | MyAccount[]>();
	visitedSpaceMsSet = $state(new Set<number>());
	msToSpaceMap = $state<Record<number | string, undefined | Space>>({
		1: {
			...getDefaultSpace(),
			ms: 1,
			isPublic: { ms: 0, num: 1 },
		},
	});
	//

	accountMsToSpaceMsToCheckedMap = $state<
		Record<
			number, //
			undefined | Record<number, boolean>
		>
	>({});

	msToProfileMap = $state<Record<number, undefined | null | PublicProfile>>({});
	idToPostMap = $state<Record<string, undefined | null | Post>>({});
	spaceMsToTagsMap = $state<
		Record<
			number,
			| undefined
			| {
					endReached: boolean;
					tags: {
						txt: string;
						num: number;
						in_ms?: number;
					}[];
			  }
		>
	>({});

	accountMsToSpaceMsToDots = $state<
		Record<
			number, //
			| undefined
			| Record<
					number,
					| undefined
					| {
							invites: Invite[];
							error?: string;
					  }
			  >
		>
	>({});
	spaceMsToDotsFeed = $state<
		Record<
			number,
			| undefined
			| {
					callerMemberMss: number[];
					endReached: boolean;
			  }
		>
	>({});
	spaceMsToAccountMsToMembershipMap = $state<
		Record<
			number,
			| undefined
			| Record<
					number,
					| undefined
					| null //
					| Partial<Membership>
			  >
		>
	>({});

	urlToPostFeedMap = $state<
		Record<
			string,
			| undefined
			| {
					topLvlPostIdStrs?: string[];
					endReached?: boolean;
					postAtBumpedPostIdObjsExclude?: FullIdObj[];
					error?: string;
			  }
		>
	>({});

	writingNew = $state<null | true>(null);
	writingEdit = $state<null | Post>(null);
	writingTo = $state<null | Post>(null);
	showReactionHistory = $state<null | Post>(null);
	writerTags = $state<string[]>([]);
	writerTagVal = $state('');
	writerCore = $state('');
}

export let gs = new GlobalState();

export let gsdb = async () => {
	let attempts = 0;
	while (!gs.db) {
		if (++attempts > 888) {
			alert(m.localDatabaseTimedOut());
			throw new Error(m.localDatabaseTimedOut());
		}
		await new Promise((res) => setTimeout(res, 42));
	}
	return gs.db;
};

export let getPromptSigningIn = () =>
	gs.accounts &&
	!gs.accounts[0].ms &&
	(getUrlInMs() === 8 ||
		page.url.pathname === '/create-space' ||
		page.url.pathname === '/merged-view');

export let getBottomOverlayShown = () =>
	gs.showReactionHistory || gs.writingNew || gs.writingTo || gs.writingEdit;

export let resetBottomOverlay = (except?: 'rh' | 'wn' | 'we' | 'wt') => {
	except !== 'rh' && (gs.showReactionHistory = null);
	except !== 'wn' && (gs.writingNew = null);
	except !== 'we' && (gs.writingEdit = null);
	except !== 'wt' && (gs.writingTo = null);
};

export let msToSpaceNameTxt = (ms: number) => {
	return ms === 8 || (ms && ms === gs.accounts?.[0].ms)
		? m.personal()
		: ms === 1
			? m.global()
			: ms
				? gs.msToSpaceMap[ms]?.name?.txt || identikana(ms)
				: m.local();
};

export let msToAccountNameTxt = (ms: number, isSystem = false) => {
	return !ms
		? isSystem
			? m.system()
			: m.anon()
		: gs.msToProfileMap[ms]?.name?.txt || identikana(ms);
};

export let getWhoObj = async () => {
	let attempts = 0;
	while (gs.accounts === undefined) {
		if (++attempts > 888) throw new Error(`getWhoObj timed out`);
		await new Promise((res) => setTimeout(res, 42));
	}
	return {
		callerMs: gs.accounts[0].ms,
	} satisfies WhoObj;
};

export let getWhoWhereObj = async (forceUsingLocalDb?: boolean) => {
	let attempts = 0;
	let urlInMs = forceUsingLocalDb ? 0 : getUrlInMs();
	if (urlInMs === undefined) throw new Error('urlInMs === undefined');
	while (gs.accounts === undefined) {
		if (++attempts > 888) throw new Error('getWhoWhereObj timed out');
		await new Promise((res) => setTimeout(res, 42));
	}
	return {
		callerMs: gs.accounts[0].ms,
		spaceMs: urlInMs,
	} satisfies WhoWhereObj;
};

export let mergeMsToAccountNameTxtMap = (msToAccountNameTxtMap: Record<number, string>) => {
	gs.msToProfileMap = {
		...gs.msToProfileMap,
		...Object.entries(msToAccountNameTxtMap).reduce(
			(obj, [ms, nt]) => ({
				...obj,
				[ms]: {
					...(gs.msToProfileMap[+ms] || getDefaultAccount()),
					name: { txt: nt },
				} satisfies PublicProfile,
			}),
			{},
		),
	};
};

export let mergeMsToSpaceNameTxtMap = (msToSpaceNameTxtMap: Record<number, string>) => {
	updateLocalCache((lc) => {
		lc.msToSpaceMap = {
			...lc.msToSpaceMap,
			...Object.entries(msToSpaceNameTxtMap).reduce(
				(obj, [ms, nt]) => ({
					...obj,
					[ms]: {
						...(gs.msToSpaceMap[+ms] || getDefaultSpace()),
						ms: +ms,
						name: { txt: nt },
					} satisfies Space,
				}),
				{},
			),
		};
		return lc;
	});
};

export let mergeSpaceMsToAccountMsToMembershipMap = (
	spaceMsToAccountMsToMembershipMap: Record<number, Record<number, Partial<Membership>>>,
) => {
	// TODO: exclude fetching already fetched role and flair in post feed
	// Only going to dots should override entries, right?
	Object.entries(spaceMsToAccountMsToMembershipMap).forEach(
		([spaceMsStr, accountMsToMembershipMap]) => {
			let spaceMs = +spaceMsStr;
			Object.entries(accountMsToMembershipMap).forEach(([accountMsStr, membership]) => {
				let accountMs = +accountMsStr;
				gs.spaceMsToAccountMsToMembershipMap[spaceMs] ||= {};
				gs.spaceMsToAccountMsToMembershipMap[spaceMs][accountMs] ||= {};
				let gsPointer = gs.spaceMsToAccountMsToMembershipMap[spaceMs][accountMs];
				if (membership.invite) gsPointer.invite = { ...membership.invite, in_ms: spaceMs };
				if (membership.accept) gsPointer.accept = { ...membership.accept, by_ms: accountMs };
				if (membership.permissionCode) gsPointer.permissionCode = membership.permissionCode;
				if (
					membership.roleCode &&
					(!gsPointer.roleCode || //
						(!gsPointer.roleCode.ms && !gsPointer.roleCode.by_ms))
				) {
					gsPointer.roleCode = membership.roleCode;
				}
				if (
					membership.flair &&
					(!gsPointer.flair || //
						(!gsPointer.flair.ms && !gsPointer.flair.by_ms))
				) {
					gsPointer.flair = membership.flair;
				}
			});
		},
	);
};

export let getUrlInMsContext = (): undefined | SpaceContext => {
	let urlInMs = getUrlInMs();
	if (!gs.accounts || urlInMs === undefined) return;
	let caller = gs.accounts[0];
	return urlInMs === 0 || urlInMs === caller.ms
		? {
				ms: urlInMs,
				roleCode: { num: roleCodes.admin },
				permissionCode: { num: permissionCodes.reactAndPost },
				accentCode: { num: accentCodes.none },
			}
		: caller.joinedSpaceContexts.find((c) => c.ms === urlInMs);
};

export let getCallerIsOwner = () => {
	let publicOwnerMss = JSON.parse(PUBLIC_OWNER_MSS) as number[];
	let callerMs = gs.accounts?.[0].ms;
	return Array.isArray(publicOwnerMss) && callerMs !== undefined
		? publicOwnerMss.includes(callerMs)
		: false;
};
