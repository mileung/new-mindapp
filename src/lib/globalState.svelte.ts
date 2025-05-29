import type { SelectThought } from '$lib';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

class GlobalState {
	theme = $state<'light' | 'dark'>()!;
	iconsSlice = $state<Record<string, string>>({});
	db = $state<SqliteRemoteDatabase<Record<string, never>>>()!;
	feeds = $state<Record<string, undefined | SelectThought[]>>({});
}

export let gs = new GlobalState();
