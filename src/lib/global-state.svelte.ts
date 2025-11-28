import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { m } from './paraglide/messages';
import type { Account } from './types/accounts';
import type { Post } from './types/posts';
import type { Space } from './types/spaces';
import { identikana, sortObjectProps } from './js';

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
	writingNew = $state(false);
	writingEdit = $state<false | Post>(false);
	writingTo = $state<false | Post>(false);
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
	searchedText: string;
}) => {
	return JSON.stringify(sortObjectProps(p));
};

export let getUndefinedLocalFeedIds = () =>
	Object.fromEntries(
		(
			[
				['nested', 'bumped'],
				['nested', 'new'],
				['nested', 'old'],
				['flat', 'new'],
				['flat', 'old'],
			] as const
		).map(([view, sortedBy]) => [
			makeFeedIdentifier({
				view,
				sortedBy,
				byMs: 0,
				idParam: 'l_l_0',
				searchedText: '',
			}),
			undefined,
		]),
	);
