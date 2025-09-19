import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ThoughtNested, ThoughtSelect } from './thoughts';
import type { Space } from './spaces';
import type { Account } from './accounts';

export type FeedRootIds = (null | string)[];

class GlobalState {
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	spaces = $state<Record<number, undefined | Space>>({});
	accounts = $state<(undefined | Account)[]>([]);
	feeds = $state<Record<string, undefined | FeedRootIds>>({});
	thoughts = $state<Record<string, undefined | null | ThoughtNested>>({});
}

export let gs = new GlobalState();
