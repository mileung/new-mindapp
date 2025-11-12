import { dev } from '$app/environment';
// import { tdb } from '$lib/server/db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, eq, gte, isNotNull, isNull, like, lte, not, or, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { z } from 'zod';
import { gsdb } from '../../local-db';
import { partsTable } from '../parts-table';
import {
	assert1Row,
	getId,
	hasParent,
	partCodes,
	type Database,
	type PartInsert,
	type PartSelect,
	idsRegex,
	splitId,
	filterIdSegs,
	filterIdSegsAsToIdSegs,
	filterToIdSegs,
	getToId,
	filterToIdSegsAsIdSegs,
} from '../parts';
import type { Post } from '.';

export let deletePost = async (id: string, useRpc: boolean) => {
	return useRpc ? trpc().deletePost.mutate(id) : _deletePost(await gsdb(), id);
};

export let _deletePost = async (db: Database, id: string) => {
	let s = splitId(id);
	if (s.in_ms) {
		if (!s.by_ms) throw new Error('Missing by_ms');
		// TODO: Verify user by_ms is logged and has access to space in_ms
	}
	if ((await _getPostChildren(db, id, 1)).length) {
		await db
			.update(partsTable)
			.set({
				body: null,
				tags: [' deleted'],
			})
			.where(filterId(id));
		return { soft: true };
	} else {
		await db.delete(partsTable).where(filterId(id));
		return { soft: false };
	}
};
