import { dev } from '$app/environment';
import { page } from '$app/state';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { promptSum } from './dom';
import { alertError, identikana, ownerMsSet } from './js';
import { m } from './paraglide/messages';
import { trpc } from './trpc/client';
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

	ownerView = $state<{
		signedInEmailRulesTxt?: string;
		accountMss?: number[];
		// accountMss?: { emailTxt: string; ms: number; banned?: Pick<IdObj, 'ms' | 'by_ms'> }[];
		accountsEndReached?: boolean;
		accountsError?: string;
		spaceMss?: number[];
		msToSpaceAdminMssMap?: Record<number, number[]>;
		spacesEndReached?: boolean;
		spacesError?: string;
	}>({});

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

export let getWhoWhereObj = async (useLocalDb?: boolean) => {
	let attempts = 0;
	let urlInMs = useLocalDb ? 0 : getUrlInMs();
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
					ms: +ms,
					name: {
						...gs.msToProfileMap[+ms]?.name,
						txt: nt,
					},
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
						name: {
							...gs.msToSpaceMap[+ms]?.name,
							txt: nt,
						},
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

export let getSpaceContext = (spaceMs?: number): undefined | SpaceContext => {
	if (!gs.accounts || spaceMs === undefined) return;
	let caller = gs.accounts[0];
	return spaceMs === 0 || spaceMs === caller.ms
		? {
				ms: spaceMs,
				roleCode: { num: roleCodes.admin },
				permissionCode: { num: permissionCodes.reactAndPost },
				flair: { txt: '' },
				accentCode: { num: accentCodes.none },
			}
		: caller.joinedSpaceContexts.find((c) => c.ms === spaceMs);
};

export let getCallerIsOwner = () => {
	let callerMs = gs.accounts?.[0].ms;
	return callerMs !== undefined ? ownerMsSet.has(callerMs) : false;
};

export let assertCallerIsOwnerOrInGlobal = () => {
	if (!getCallerIsOwner() && !gs.accounts?.[0].joinedSpaceContexts.some((sc) => sc.ms === 1)) {
		throw new Error(m.becomeAGlobalMemberToUseThisAction());
	}
};

export let toggleAccountBan = async (accountMs: number) => {
	let account = gs.msToProfileMap[accountMs]!;
	if (
		promptSum((a, b) =>
			m.enterTheSumOfAAndBToBanC({
				a,
				b,
				c: `${msToAccountNameTxt(account.ms)} (${account.email!.txt})`,
			}),
		)
	) {
		try {
			let { ms } = await trpc().setAccountBan.mutate({
				...(await getWhoObj()),
				accountMs: account.ms,
				banned: !account.banned,
			});
			account.banned = account.banned ? undefined : { ms, by_ms: gs.accounts?.[0].ms! };
		} catch (error) {
			alertError(error);
		}
	}
};
