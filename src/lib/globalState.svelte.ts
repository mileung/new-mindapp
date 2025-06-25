import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ThoughtSelect } from './thoughts';

class GlobalState {
	theme = $state<'light' | 'dark'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	feeds = $state<Record<string, undefined | string[]>>({});
	thoughts = $state<Record<string, null | ThoughtSelect>>({});
}

export let gs = new GlobalState();
