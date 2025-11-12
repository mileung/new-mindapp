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
	writingNew = $state(!false);
	writingEdit = $state<false | PartInsert>(false);
	writingTo = $state<false | PartInsert>(false);
	writerTags = $state<string[]>(['2000s']);
	writerTagVal = $state('');
	writerBody = $state('test');
}

export let gs = new GlobalState();

export let spaceMsToSpaceName = (ms: null | number) => {
	return ms === 0 ? m.personal() : ms === 1 ? m.global() : ms ? gs.spaces[ms]?.ms : m.local();
};
