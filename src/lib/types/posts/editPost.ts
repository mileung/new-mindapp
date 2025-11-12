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
import { getLastVersion, normalizeTags, type Post } from '.';

export let editPost = async (post: Post, useRpc: boolean) => {
	return useRpc ? trpc().editPost.mutate(post) : _editPost(await gsdb(), post);
};

export let _editPost = async (db: Database, post: Post) => {
	let lastVersion = getLastVersion(post);
	if (lastVersion > 0) throw new Error('lastVersion must be gt0');
	if (Number.isInteger(post.in_ms) && !post.by_ms) throw new Error('Missing by_ms');
	let ms = Date.now();

	if (!post.ms) throw new Error('Missing ms');

	let postPartRows = await db
		.select()
		.from(partsTable)
		.where(
			and(
				filterToIdSegs(post),
				filterIdSegs(post),
				eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
				isNull(partsTable.txt),
			),
		);
	let postPart = assert1Row(postPartRows);
	if (postPart.code === partCodes.postIdWithNumAsLastVersionToParentPostId)
		throw new Error('Cannot edit deleted posts');
	if (postPart.code === partCodes.postIdWithNumAsLastVersionToParentPostId) {
		// update
	}
	if (postPart.code === partCodes.postIdWithNumAsLastVersionToParentPostId) {
		if (postPart.code + 1 !== lastVersion) throw new Error(`Invalid lastVersion`);
	}
	let postTags = normalizeTags(post.history[lastVersion].tags || []);

	// await db
	// 	.update(partsTable)
	// 	.set({ ...t, tags })
	// 	.where(filterIdSegs(t));
	// return tags;

	// insert
	// {
	// 			to_ms: ms,
	// 			to_by_ms: postPart.by_ms,
	// 			to_in_ms: postPart.in_ms,
	// 			ms,
	// 			by_ms: null,
	// 			in_ms: null,
	// 			code: partCodes.msWithNumAsVersionToPostId,
	// 			txt: null,
	// 			num: 0,
	// 		},
};
