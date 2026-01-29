import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { sortObjectProps } from './js';
import type { MyAccount } from './types/accounts';
import type { Post } from './types/posts';
import type { Invite, Membership } from './types/spaces';

class GlobalState {
	invalidLocalCache = $state(false);
	localDbFailed = $state(false);
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	currentSpaceMs = $state<number>();
	accountMsToSpaceMsToMembershipMap = $state<
		Record<
			number,
			| undefined //
			| Record<
					number,
					| undefined
					| null // null means no membership, undefined means hasn't loaded yet
					| Membership
			  >
		>
	>({});

	accounts = $state<undefined | MyAccount[]>();
	pendingInvite = $state<Invite>();

	msToAccountNameTxtMap = $state<Record<number, undefined | string>>({});
	msToSpaceNameTxtMap = $state<Record<number, undefined | string>>({});
	spaceMsToMapOwnerAccountMs = $state<Record<number, undefined | Record<number, boolean>>>({});
	spaceMsToMapModAccountMs = $state<Record<number, undefined | Record<number, boolean>>>({});

	idToPostMap = $state<Record<string, undefined | null | Post>>({});
	indentifierToFeedMap = $state<Record<string, undefined | string[]>>({});

	writingNew = $state<null | true>(null);
	writingEdit = $state<null | Post>(null);
	writingTo = $state<null | Post>(null);
	showReactionHistory = $state<null | Post>(null);
	writerTags = $state<string[]>([]);
	writerTagVal = $state('');
	writerCore = $state('');
}

export let gs = new GlobalState();

export let makeFeedIdentifier = (p: {
	view: 'nested' | 'flat';
	sortedBy: 'bumped' | 'new' | 'old';
	byMs: number;
	idParam: string;
	qSearchParam: string;
}) => {
	return JSON.stringify(sortObjectProps(p));
};

export let getBottomOverlayShown = () =>
	gs.showReactionHistory || gs.writingNew || gs.writingTo || gs.writingEdit;

export let resetBottomOverlay = (except?: 'rh' | 'wn' | 'we' | 'wt') => {
	except !== 'rh' && (gs.showReactionHistory = null);
	except !== 'wn' && (gs.writingNew = null);
	except !== 'we' && (gs.writingEdit = null);
	except !== 'wt' && (gs.writingTo = null);
};
