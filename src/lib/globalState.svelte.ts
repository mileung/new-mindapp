import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ThoughtSelect } from './thoughts';
import type { Space } from './spaces';
import type { Persona } from './personas';

export type FeedRootIds = (null | string)[];

class GlobalState {
	theme = $state<'light' | 'dark' | 'system'>();
	db = $state<SqliteRemoteDatabase<Record<string, never>>>();
	spaces = $state<Record<number, undefined | Space>>({});
	personas = $state<(undefined | Persona)[]>([]);
	feeds = $state<Record<string, undefined | FeedRootIds>>({});
	thoughts = $state<Record<string, undefined | null | ThoughtSelect>>({});
}

export let gs = new GlobalState();
