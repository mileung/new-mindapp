import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { MyAccount, Profile } from './types/accounts';
import type { FullIdObj } from './types/parts/partIds';
import type { Post } from './types/posts';
import type { Invite, Membership, Space } from './types/spaces';

class GlobalState {
	invalidLocalCache = $state(false);
	localDbFailed = $state(false);
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	pendingInvite = $state<Invite>();

	// local-cache
	urlInMs = $state<number>();
	accounts = $state<undefined | MyAccount[]>();
	//

	idToPostMap = $state<Record<string, undefined | null | Post>>({});
	accountMsToNameTxtMap = $state<Record<number, undefined | string>>({});
	msToSpaceNameTxtMap = $state<Record<number, undefined | string>>({});
	spaceMsToAccountMsToRoleNumMap = $state<Record<number, undefined | Record<number, number>>>({});

	accountMsToSpaceMsToCheckedMap = $state<
		Record<
			number, //
			undefined | Record<number, boolean>
		>
	>({});

	urlToFeedMap = $state<
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
	msToProfileMap = $state<Record<number, undefined | Profile>>({});
	spaceMsToDotsMap = $state<
		Record<
			string,
			| undefined
			| {
					space?: Space;
					endReached?: boolean;
					memberships?: Membership[];
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

export let getBottomOverlayShown = () =>
	gs.showReactionHistory || gs.writingNew || gs.writingTo || gs.writingEdit;

export let resetBottomOverlay = (except?: 'rh' | 'wn' | 'we' | 'wt') => {
	except !== 'rh' && (gs.showReactionHistory = null);
	except !== 'wn' && (gs.writingNew = null);
	except !== 'we' && (gs.writingEdit = null);
	except !== 'wt' && (gs.writingTo = null);
};
