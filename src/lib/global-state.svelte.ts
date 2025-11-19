import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { m } from './paraglide/messages';
import type { Account } from './types/accounts';
import type { PartInsert } from './types/parts';
import type { Post } from './types/posts';
import type { Space } from './types/spaces';

class GlobalState {
	invalidLocalCache = $state(false);
	localDbFailed = $state(false);
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	currentSpaceMs = $state<null | number>();
	spaces = $state<Record<number, undefined | Space>>({});
	accounts = $state<undefined | Account[]>();
	feeds = $state<Record<string, undefined | (null | string)[]>>({});
	posts = $state<Record<string, undefined | null | Post>>({});
	writingNew = $state(false);
	writingEdit = $state<false | PartInsert>(false);
	writingTo = $state<false | PartInsert>(false);
	writerTags = $state<string[]>([]);
	writerTagVal = $state('');
	writerBody = $state('');
}

export let gs = new GlobalState();

export let spaceMsToSpaceName = (ms: null | number) => {
	return ms === 0 ? m.personal() : ms === 1 ? m.global() : ms ? gs.spaces[ms]?.ms : m.local();
};

export let makeFeedIdentifier = (p: {
	view: 'nested' | 'linear';
	sortedBy: 'bumped' | 'new' | 'old';
	callerMs: number | null;
	idParam: string;
	searchedText: string;
}) => {
	return JSON.stringify(p);
};

export let getUndefinedLocalFeedIds = () =>
	Object.fromEntries(
		(
			[
				['nested', 'bumped'],
				['nested', 'new'],
				['nested', 'old'],
				['linear', 'new'],
				['linear', 'old'],
			] as const
		).map(([view, sortedBy]) => [
			makeFeedIdentifier({
				view,
				sortedBy,
				callerMs: null,
				idParam: 'l_l_',
				searchedText: '',
			}),
			undefined,
		]),
	);
