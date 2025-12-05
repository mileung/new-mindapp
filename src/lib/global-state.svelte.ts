import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { identikana, sortObjectProps } from './js';
import { m } from './paraglide/messages';
import type { Account } from './types/accounts';
import type { Post } from './types/posts';
import type { Space } from './types/spaces';

class GlobalState {
	invalidLocalCache = $state(false);
	localDbFailed = $state(false);
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	currentSpaceMs = $state<number>();
	idToSpaceMap = $state<Record<number, undefined | Space>>({});
	accounts = $state<undefined | Account[]>();
	indentifierToFeedMap = $state<Record<string, undefined | (null | string)[]>>({});
	idToPostMap = $state<Record<string, undefined | null | Post>>({});
	writingNew = $state<null | true>(null);
	writingEdit = $state<null | Post>(null);
	writingTo = $state<null | Post>(null);
	showReactionHistory = $state<null | Post>(null);
	writerTags = $state<string[]>([]);
	writerTagVal = $state('');
	writerCore = $state('');
}

export let gs = new GlobalState();

export let spaceMsToSpaceName = (ms: number) => {
	return ms === 8
		? m.personal()
		: ms === 1
			? m.global()
			: ms
				? gs.idToSpaceMap[ms]?.name || identikana(ms)
				: m.local();
};

export let makeFeedIdentifier = (p: {
	view: 'nested' | 'flat';
	sortedBy: 'bumped' | 'new' | 'old';
	byMs: number;
	idParam: string;
	qSearchParam: string;
}) => {
	return JSON.stringify(sortObjectProps(p));
};

export let resetBottomOverlay = (except?: 'rh' | 'wn' | 'we' | 'wt') => {
	except !== 'rh' && (gs.showReactionHistory = null);
	except !== 'wn' && (gs.writingNew = null);
	except !== 'we' && (gs.writingEdit = null);
	except !== 'wt' && (gs.writingTo = null);
};
