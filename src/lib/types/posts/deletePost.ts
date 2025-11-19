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
	getSplitId,
	filterSplitId,
	filterSplitIdAsToSplitId,
	filterToSplitId,
	getToId,
	filterToSplitIdAsSplitId,
	type SplitId,
	type SplitIdToSplitId,
} from '../parts';
import type { Post } from '.';

export let deletePost = async (
	postSplitIdToSplitId: SplitIdToSplitId,
	version: number,
	useRpc: boolean,
) => {
	return useRpc
		? trpc().deletePost.mutate({ postSplitIdToSplitId, version })
		: _deletePost(await gsdb(), postSplitIdToSplitId, version);
};

export let _deletePost = async (
	db: Database,
	postSplitIdToSplitId: SplitIdToSplitId,
	version: number,
) => {
	if (Number.isInteger(postSplitIdToSplitId.in_ms) && !postSplitIdToSplitId.by_ms)
		throw new Error('Missing by_ms');

	let postIdRowFilter = and(
		filterToSplitId(postSplitIdToSplitId),
		filterSplitId(postSplitIdToSplitId),
		eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
	);

	let postIdRows: PartSelect[] = [];
	let replyPostIdRows: PartSelect[] = [];
	let postIdRowsAndReplyPostIdRows = await db
		.select()
		.from(partsTable)
		.where(
			or(
				postIdRowFilter,
				and(
					filterSplitIdAsToSplitId(postSplitIdToSplitId),
					eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
				),
			),
		);

	for (let i = 0; i < postIdRowsAndReplyPostIdRows.length; i++) {
		let row = postIdRowsAndReplyPostIdRows[i];
		if (
			row.to_ms === postSplitIdToSplitId.to_ms &&
			row.to_by_ms === postSplitIdToSplitId.to_by_ms &&
			row.to_in_ms === postSplitIdToSplitId.to_in_ms &&
			row.ms === postSplitIdToSplitId.ms &&
			row.by_ms === postSplitIdToSplitId.by_ms &&
			row.in_ms === postSplitIdToSplitId.in_ms
		) {
			postIdRows.push(row);
		} else if (
			row.to_ms === postSplitIdToSplitId.ms &&
			row.to_by_ms === postSplitIdToSplitId.by_ms &&
			row.to_in_ms === postSplitIdToSplitId.in_ms
		) {
			replyPostIdRows.push(row);
		} else {
			throw new Error(`Unknown row found`);
		}
	}

	let postIdRow = assert1Row(postIdRows);
	let lastVersion = postIdRow.num;
	if (lastVersion) {
		//
	} else if (!version) {
		let partRowsToPost = await db
			.select()
			.from(partsTable)
			.where(filterSplitIdAsToSplitId(postSplitIdToSplitId));

		console.log('partRowsToPost:', partRowsToPost);
	} else {
		throw new Error(`Post version dne`);
	}

	// if (replyPostIdRows.length) {
	// 	await db.update(partsTable).set({ num: null }).where(postIdRowFilter);
	// 	return { soft: true };
	// } else {
	// 	await db.delete(partsTable).where(or(postIdRowFilter));
	// 	return { soft: false };
	// }
};
