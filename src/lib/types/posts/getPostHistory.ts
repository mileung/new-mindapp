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
	assertLt2Rows,
	type SplitId,
	type SplitIdToSplitId,
} from '../parts';
import { getCitedPostIds, normalizeTags, type Post } from '.';

export let getPostHistory = async (
	postSplitIdToSplitId: SplitIdToSplitId,
	version: number,
	useRpc: boolean,
) => {
	return useRpc
		? trpc().getPostHistory.mutate({ postSplitIdToSplitId, version })
		: _getPostHistory(await gsdb(), postSplitIdToSplitId, version);
};

// TODO: paginate history versions
export let _getPostHistory = async (
	db: Database,
	postSplitIdToSplitId: SplitIdToSplitId,
	version: number,
) => {
	if (Number.isInteger(postSplitIdToSplitId.in_ms) && !postSplitIdToSplitId.by_ms)
		throw new Error('Missing by_ms');
	let postSubParts = await db
		.select()
		.from(partsTable)
		.where(
			and(
				filterSplitIdAsToSplitId(postSplitIdToSplitId),
				or(
					...[
						partCodes.currentPostTagIdWithNumAsVersionToPostId,
						partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId,
						partCodes.exPostTagIdWithNumAsVersionToPostId,
						partCodes.exPostBodyTxtWithMsAndNumAsVersionToPostId,
					].map((code) => eq(partsTable.code, code)),
				),
				eq(partsTable.num, version),
			),
		);

	let tagIdsSet = new Set<string>();
	let tagIdRows: PartSelect[] = [];
	let bodyRows: PartSelect[] = [];

	for (let i = 0; i < postSubParts.length; i++) {
		let part = postSubParts[i];
		if (
			part.code === partCodes.currentPostTagIdWithNumAsVersionToPostId ||
			part.code === partCodes.exPostTagIdWithNumAsVersionToPostId
		) {
			let tagId = getId(part);
			if (part.ms && !tagIdsSet.has(tagId)) {
				tagIdsSet.add(tagId);
				tagIdRows.push(part);
			}
		} else if (
			part.code === partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId ||
			part.code === partCodes.exPostBodyTxtWithMsAndNumAsVersionToPostId
		) {
			bodyRows.push(part);
		}
	}
	assert1Row(bodyRows);
	let tagRows = tagIdRows.length
		? await db
				.select()
				.from(partsTable)
				.where(
					and(
						or(...tagIdRows.map((row) => filterSplitId(row))),
						isNull(partsTable.to_ms),
						isNull(partsTable.to_by_ms),
						isNull(partsTable.to_in_ms),
						eq(partsTable.code, partCodes.tagTxtAndNumAsCount),
						isNotNull(partsTable.txt),
						eq(partsTable.num, version),
					),
				)
		: [];

	let parts = [...postSubParts, ...tagRows];
	let tagIdToTxtMap: Record<string, string> = {};
	let history: Post['history'] = { [version]: { ms: postSplitIdToSplitId.ms!, body: '' } };

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		if (
			part.code === partCodes.currentPostTagIdWithNumAsVersionToPostId ||
			part.code === partCodes.exPostTagIdWithNumAsVersionToPostId
		) {
			if (part.ms !== null) {
				history[version]!.tags = [getId(part), ...(history[version]!.tags || [])];
			}
		} else if (
			part.code === partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId ||
			part.code === partCodes.exPostBodyTxtWithMsAndNumAsVersionToPostId
		) {
			history[version]!.body = part.txt;
			history[version]!.ms = part.ms!;
		} else if (part.code === partCodes.tagTxtAndNumAsCount) {
			tagIdToTxtMap[getId(part)] = part.txt!;
		}
	}

	if (history[version]?.tags) {
		for (let i = 0; i < history[version].tags.length; i++) {
			history[version].tags[i] = tagIdToTxtMap[history[version].tags[i]];
		}
	}

	return { history };
};
