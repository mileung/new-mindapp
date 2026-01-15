import { trpc } from '$lib/trpc/client';
import { and, or, type SQL } from 'drizzle-orm';
import { moveTagCoreOrRxnCountsBy1, selectTagOrCoreTxtRowsToDelete } from '.';
import { gsdb, type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	getWhoWhereObj,
	hasParent,
	makePartsUniqueById,
	type PartInsert,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getAtIdObj, getAtIdObjAsIdObj, getFullIdObj, type FullIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let deletePost = async (
	fullPostIdObj: FullIdObj,
	version: null | number,
	forceUsingLocalDb?: boolean,
) => {
	let baseInput = await getWhoWhereObj();
	return forceUsingLocalDb || !baseInput.spaceMs
		? _deletePost(await gsdb(), fullPostIdObj, version)
		: trpc().deletePost.mutate({ ...baseInput, fullPostIdObj, version });
};

export let _deletePost = async (db: Database, fullPostIdObj: FullIdObj, version: null | number) => {
	let deleteAllVersions = version === null;
	let partsToInsert: PartInsert[] = [];

	let mainPIdWNumAsLastVersionAtPPIdRowsFilter = and(
		pf.atId(fullPostIdObj),
		pf.id(fullPostIdObj),
		pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
		pf.txt.isNull,
	);
	let postIdAtBumpedRootIdRowsFilter = and(
		pf.id(fullPostIdObj),
		pf.code.eq(pc.postIdAtBumpedRootId),
		pf.num.eq0,
		pf.txt.isNull,
	);

	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: mainPIdWNumAsLastVersionAtPPIdRows = [],
		[pc.postIdAtBumpedRootId]: postIdAtBumpedRootIdRows = [],
		[pc.currentPostTagIdWithVersionNumAtPostId]: curPostTagIdWNumAsVersionAtPIdRowsToDelete = [],
		[pc.exPostTagIdWithVersionNumAtPostId]: exPostTagIdWithNumAsVersionAtPostIdRows = [],
		[pc.currentPostCoreIdWithVersionNumAtPostId]: curPostCoreIdWNumAsVrsnAtPIdRowsToDelete = [],
		[pc.exPostCoreIdWithVersionNumAtPostId]: exPostCoreIdWithNumAsVersionAtPostIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					mainPIdWNumAsLastVersionAtPPIdRowsFilter,
					postIdAtBumpedRootIdRowsFilter,
					and(
						pf.idAsAtId(fullPostIdObj),
						pf.ms.gt0,
						or(
							pf.code.eq(pc.currentPostTagIdWithVersionNumAtPostId),
							pf.code.eq(pc.exPostTagIdWithVersionNumAtPostId),
							pf.code.eq(pc.currentPostCoreIdWithVersionNumAtPostId),
							pf.code.eq(pc.exPostCoreIdWithVersionNumAtPostId),
						),
						version === null ? undefined : pf.num.eq(version),
						pf.txt.isNull,
					),
				),
			),
	);

	let mainPIdWNumAsLastVersionAtPPIdRow = assert1Row(mainPIdWNumAsLastVersionAtPPIdRows);
	let lastVersion = mainPIdWNumAsLastVersionAtPPIdRow.num!;
	let versionIsLastVersion = version === lastVersion;
	if (!lastVersion && versionIsLastVersion && !deleteAllVersions) deleteAllVersions = true;

	if (deleteAllVersions || versionIsLastVersion) {
		await moveTagCoreOrRxnCountsBy1(
			db,
			curPostTagIdWNumAsVersionAtPIdRowsToDelete,
			curPostCoreIdWNumAsVrsnAtPIdRowsToDelete,
			[],
			false,
		);
	} else {
		// Bump up tags from previous version? What if last version is deleted but already has interactions? Then the last version would be soft deleted. May end up scrapping the idea of deleting individual versions.
		throw new Error(`cannot delete specific version yet?`);
	}

	let postIsParent = !!(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pf.idAsAtId(fullPostIdObj),
					pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
					pf.num.gte0,
					pf.txt.isNull,
				),
			)
			.limit(1)
	).length;

	let postIdAtBumpedRootIdRow = assertLt2Rows(postIdAtBumpedRootIdRows);
	let deleteFilters: (undefined | SQL)[] = [];

	if (deleteAllVersions) {
		postIsParent &&
			(await db.update(pTable).set({ num: 0 }).where(mainPIdWNumAsLastVersionAtPPIdRowsFilter));
		deleteFilters.push(
			...(postIsParent
				? []
				: [
						mainPIdWNumAsLastVersionAtPPIdRowsFilter,
						and(
							pf.id(fullPostIdObj), //
							pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							pf.num.gte0,
						),
					]),
			and(
				pf.idAsAtId(fullPostIdObj),
				or(
					...[
						pc.currentVersionNumMsAtPostId,
						pc.exVersionNumMsAtPostId,
						pc.currentSoftDeletedVersionNumMsAtPostId,
						pc.exSoftDeletedVersionNumMsAtPostId,
						pc.currentPostTagIdWithVersionNumAtPostId,
						pc.exPostTagIdWithVersionNumAtPostId,
						pc.currentPostCoreIdWithVersionNumAtPostId,
						pc.exPostCoreIdWithVersionNumAtPostId,
					].map((c) => pf.code.eq(c)),
				),
				pf.num.gte0,
			),
		);
		if (postIdAtBumpedRootIdRow) {
			deleteFilters.push(postIdAtBumpedRootIdRowsFilter);
			let previousChildPostIdAtBumpRootIdObj = (
				await db
					.select()
					.from(pTable)
					.where(
						and(
							pf.atId(postIdAtBumpedRootIdRow),
							pf.notId(fullPostIdObj),
							pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							pf.num.gte0,
						),
					)
					.orderBy(pf.ms.desc)
					.limit(1)
			)[0];
			hasParent(fullPostIdObj) &&
				partsToInsert.push({
					...(previousChildPostIdAtBumpRootIdObj
						? getFullIdObj(previousChildPostIdAtBumpRootIdObj)
						: {
								...getAtIdObj(postIdAtBumpedRootIdRow),
								...getAtIdObjAsIdObj(postIdAtBumpedRootIdRow),
							}),
					code: pc.postIdAtBumpedRootId,
					num: 0,
				});
		}
	} else {
		// TODO: delete specific version
		throw new Error(`cannot delete specific version yet?`);
	}

	let checkForNum0Tags =
		curPostTagIdWNumAsVersionAtPIdRowsToDelete.length ||
		exPostTagIdWithNumAsVersionAtPostIdRows.length;
	let checkForNum0Cores =
		curPostCoreIdWNumAsVrsnAtPIdRowsToDelete.length ||
		exPostCoreIdWithNumAsVersionAtPostIdRows.length;
	let {
		[pc.tagId8AndTxtWithNumAsCount]: num0tagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8AndTxtWithNumAsCount]: num0coreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		checkForNum0Tags || checkForNum0Cores
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							checkForNum0Tags
								? and(
										pf.noParent,
										pf.ms.gt0,
										or(
											...makePartsUniqueById([
												...curPostTagIdWNumAsVersionAtPIdRowsToDelete,
												...exPostTagIdWithNumAsVersionAtPostIdRows,
											]).map((r) => pf.id(r)),
										),
										pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
										pf.num.eq0,
										pf.txt.isNotNull,
									)
								: undefined,
							checkForNum0Cores
								? and(
										pf.noParent,
										pf.ms.gt0,
										or(
											...makePartsUniqueById([
												...curPostCoreIdWNumAsVrsnAtPIdRowsToDelete,
												...exPostCoreIdWithNumAsVersionAtPostIdRows,
											]).map((r) => pf.id(r)),
										),
										pf.code.eq(pc.coreId8AndTxtWithNumAsCount),
										pf.num.eq0,
										pf.txt.isNotNull,
									)
								: undefined,
						),
					)
			: [],
	);
	await selectTagOrCoreTxtRowsToDelete(
		db,
		fullPostIdObj,
		num0tagIdAndTxtWithNumAsCountRows,
		deleteFilters,
		true,
	);
	await selectTagOrCoreTxtRowsToDelete(
		db,
		fullPostIdObj,
		num0coreIdAndTxtWithNumAsCountRows,
		deleteFilters,
		false,
	);
	deleteFilters.length && (await db.delete(pTable).where(or(...deleteFilters)));
	partsToInsert.length && (await db.insert(pTable).values(partsToInsert));
	return { soft: postIsParent };
};
