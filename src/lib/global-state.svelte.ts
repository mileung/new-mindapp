import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ThoughtNested, ThoughtSelect } from './types/thoughts';
import type { Space } from './types/spaces';
import type { Account } from './types/accounts';

export type FeedSequence = [...string[], number | null]; // Strings are ids. Ending number is the fromMs. Ending null is the feed has terminated

class GlobalState {
	invalidLocalCache = $state(false);
	localDbFailed = $state(false);
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	currentSpaceMs = $state<`` | number>('');
	spaces = $state<Record<number, undefined | Space>>({});
	accounts = $state<undefined | Account[]>();
	feeds = $state<Record<string, undefined | FeedSequence>>({});
	thoughts = $state<Record<string, undefined | null | ThoughtNested>>({});
	writerMode = $state<'' | 'new' | ['to' | 'edit', string]>('');
	writerTags = $state<string[]>([]);
	writerTagVal = $state('');
	writerBody = $state('');
}

export let gs = new GlobalState();
