import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ThoughtNested, ThoughtSelect } from './thoughts';
import type { Space } from './spaces';
import type { Account } from './accounts';

export type FeedSequence = [...string[], number | null]; // Strings are ids. Ending number is the fromMs. Ending null is the feed has terminated

class GlobalState {
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	spaces = $state<Record<string, undefined | Space>>({});
	accounts = $state<Account[]>([]);
	feeds = $state<Record<string, undefined | FeedSequence>>({});
	thoughts = $state<Record<string, undefined | null | ThoughtNested>>({});
	writerMode = $state<'' | 'new' | ['to' | 'edit', string]>('');
	writerTags = $state<string[]>([]);
	writerTagVal = $state('');
	writerBody = $state('');
}

export let gs = new GlobalState();
