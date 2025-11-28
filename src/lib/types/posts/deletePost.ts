import { trpc } from '$lib/trpc/client';
import { and, desc, eq, isNull, or, SQL } from 'drizzle-orm';
import { bumpTagCountsBy1 } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, getBaseInput, type PartSelect } from '../parts';
import { pTable } from '../parts/partsTable';
import { getIdStr, type FullIdObj } from '../parts/partIds';
import { pt } from '../parts/partFilters';
import { pc } from '../parts/partCodes';

export let deletePost = async (fullPostId: FullIdObj, version: null | number, useRpc: boolean) => {
	return useRpc
		? trpc().deletePost.mutate({ ...getBaseInput(), fullPostId, version })
		: _deletePost(await gsdb(), fullPostId, version);
};

export let _deletePost = async (db: Database, fullPostId: FullIdObj, version: null | number) => {
	if (fullPostId.in_ms > 0 && !fullPostId.by_ms) throw new Error('Invalid by_ms');
	let deleteAllVersions = version === null;
	if (!deleteAllVersions && version! < 0) throw new Error(`Invalid version`);

	let postIdRowFilter = and(
		pt.atId(fullPostId),
		pt.id(fullPostId),
		pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
		pt.txt.isNull,
	);
	let postToBumpedRootFilter = and(
		pt.id(fullPostId),
		pt.code.eq(pc.postIdAtBumpedRootId),
		pt.txt.isNull,
		pt.num.isNull,
	);

	let postIdAndPostToBumpedRootAndTagIdRows = await db
		.select()
		.from(pTable)
		.where(
			or(
				postIdRowFilter,
				postToBumpedRootFilter,
				and(
					pt.idAsAtId(fullPostId),
					pt.ms.gt0,
					or(
						pt.code.eq(pc.currentPostTagIdWithNumAsVersionAtPostId),
						pt.code.eq(pc.exPostTagIdWithNumAsVersionAtPostId),
					),
					pt.txt.isNull,
					version === null ? undefined : pt.num.eq(version),
				),
			),
		);

	let postIdRows: PartSelect[] = [];
	let postToBumpedRootRows: PartSelect[] = [];
	let allPostTagIdsSet = new Set<string>();
	let allPostTagIdRowsToDelete: PartSelect[] = [];
	let currentPostTagIdsSet = new Set<string>();
	let currentPostTagIdRowsToDelete: PartSelect[] = [];
	let exPostTagIdsSet = new Set<string>();
	let exPostTagIdRowsToDelete: PartSelect[] = [];

	for (let i = 0; i < postIdAndPostToBumpedRootAndTagIdRows.length; i++) {
		let part = postIdAndPostToBumpedRootAndTagIdRows[i];
		if (part.code === pc.postIdWithNumAsLastVersionAtParentPostId) {
			postIdRows.push(part);
		} else if (part.code === pc.postIdAtBumpedRootId) {
			postToBumpedRootRows.push(part);
		} else if (
			part.code === pc.currentPostTagIdWithNumAsVersionAtPostId ||
			part.code === pc.exPostTagIdWithNumAsVersionAtPostId
		) {
			let tagId = getIdStr(part);
			if (part.ms && !allPostTagIdsSet.has(tagId)) {
				allPostTagIdsSet.add(tagId);
				allPostTagIdRowsToDelete.push(part);
			}
			if (part.code === pc.currentPostTagIdWithNumAsVersionAtPostId) {
				if (part.ms && !currentPostTagIdsSet.has(tagId)) {
					currentPostTagIdsSet.add(tagId);
					currentPostTagIdRowsToDelete.push(part);
				}
			} else if (part.code === pc.exPostTagIdWithNumAsVersionAtPostId) {
				if (part.ms && !exPostTagIdsSet.has(tagId)) {
					exPostTagIdsSet.add(tagId);
					exPostTagIdRowsToDelete.push(part);
				}
			}
		}
	}

	let postIdRow = assert1Row(postIdRows);
	let lastVersion = postIdRow.num!;
	let versionIsLastVersion = version === lastVersion;
	if (!lastVersion && versionIsLastVersion && !deleteAllVersions) deleteAllVersions = true;

	if (deleteAllVersions || versionIsLastVersion) {
		await bumpTagCountsBy1(db, currentPostTagIdRowsToDelete, false);
	}

	let postIsParent = !!(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pt.idAsAtId(fullPostId),
					pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
					pt.txt.isNull,
					pt.num.isNotNull,
				),
			)
			.limit(1)
	).length;

	let deleteFilters: (undefined | SQL)[] = [];

	if (deleteAllVersions) {
		if (postIsParent) await db.update(pTable).set({ num: null }).where(postIdRowFilter);
		deleteFilters.push(
			...(postIsParent
				? []
				: [
						postIdRowFilter,
						and(
							pt.id(postIdRow), //
							pt.code.eq(pc.postIdWithNumAsDepthAtRootId),
							pt.num.isNotNull,
						),
					]),
			and(
				pt.idAsAtId(postIdRow),
				or(
					...[
						pc.currentPostCoreIdWithNumAsVersionAtPostId,
						pc.exPostCoreIdWithNumAsVersionAtPostId,
						pc.currentPostTagIdWithNumAsVersionAtPostId,
						pc.exPostTagIdWithNumAsVersionAtPostId,
					].map((c) => pt.code.eq(c)),
				),
				pt.num.isNotNull,
			),
		);
		if (postToBumpedRootRows.length) {
			deleteFilters.push(postToBumpedRootFilter);
			let postToBumpedRootRow = assert1Row(postToBumpedRootRows);
			let lastPostToBumpRootRows = await db
				.select()
				.from(pTable)
				.where(
					and(
						pt.atId(postToBumpedRootRow),
						pt.code.eq(pc.postIdWithNumAsDepthAtRootId),
						pt.num.isNotNull,
					),
				)
				.orderBy(pt.ms.desc)
				.limit(1);
			if (lastPostToBumpRootRows.length) {
				let lastPostToBumpedRootRow = assert1Row(lastPostToBumpRootRows);
				await db.insert(pTable).values({
					at_ms: lastPostToBumpedRootRow.at_ms,
					at_by_ms: lastPostToBumpedRootRow.at_by_ms,
					at_in_ms: lastPostToBumpedRootRow.at_in_ms,
					ms: lastPostToBumpedRootRow.ms,
					by_ms: lastPostToBumpedRootRow.by_ms,
					in_ms: lastPostToBumpedRootRow.in_ms,
					code: pc.postIdAtBumpedRootId,
					txt: null,
					num: null,
				});
			} else if (postIdRow.at_ms !== null) {
				await db.insert(pTable).values({
					at_ms: postIdRow.at_ms,
					at_by_ms: postIdRow.at_by_ms,
					at_in_ms: postIdRow.at_in_ms,
					ms: postIdRow.at_ms,
					by_ms: postIdRow.at_by_ms,
					in_ms: postIdRow.at_in_ms,
					code: pc.postIdAtBumpedRootId,
					txt: null,
					num: null,
				});
			}
		}
	} else {
		// TODO: delete specific version
		throw new Error(`cannot delete specific version yet`);
	}

	let tagTxtRowsToPossiblyDelete = allPostTagIdRowsToDelete.length
		? await db
				.select()
				.from(pTable)
				.where(
					and(
						pt.at_ms.eq0,
						pt.at_by_ms.eq0,
						pt.at_in_ms.eq0,
						pt.ms.gt0,
						pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
						or(...allPostTagIdRowsToDelete.map((r) => pt.id(r))),
						eq(pTable.num, 0),
					),
				)
		: [];

	if (tagTxtRowsToPossiblyDelete.length) {
		let postTagIdRowsUsing0CountTags = await Promise.all(
			tagTxtRowsToPossiblyDelete.map(
				async (row) =>
					(
						await db
							.select()
							.from(pTable)
							.where(
								and(
									pt.at_ms.gt0,
									pt.at_by_ms.eq0,
									pt.at_in_ms.eq0,
									pt.id(row),
									or(
										pt.code.eq(pc.currentPostTagIdWithNumAsVersionAtPostId),
										pt.code.eq(pc.exPostTagIdWithNumAsVersionAtPostId),
									),
									pt.txt.eq(row.txt!),
									pt.num.isNotNull,
								),
							)
							.limit(1)
					)[0] as undefined | PartSelect,
			),
		);

		let tagTxtRowsToDelete = tagTxtRowsToPossiblyDelete.filter(
			(rowToPossiblyDelete) =>
				!postTagIdRowsUsing0CountTags.find(
					(r) =>
						rowToPossiblyDelete.ms === r?.ms && //
						rowToPossiblyDelete.by_ms === r?.by_ms &&
						rowToPossiblyDelete.in_ms === r?.in_ms,
				),
		);

		tagTxtRowsToDelete.length &&
			deleteFilters.push(
				and(
					pt.at_ms.eq0,
					pt.at_by_ms.eq0,
					pt.at_in_ms.eq0,
					or(
						...tagTxtRowsToDelete.map((r) =>
							and(
								pt.id(r), //
								pt.txt.eq(r.txt!),
							),
						),
					),
					pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
					eq(pTable.num, 0),
				),
			);
	}

	deleteFilters.length && (await db.delete(pTable).where(or(...deleteFilters)));

	return { soft: postIsParent };
};
