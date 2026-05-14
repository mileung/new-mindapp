import { getWhoObj, gsdb } from '$lib/global-state.svelte';
import { trpc } from '$lib/trpc/client';
import { and, or, type SQL } from 'drizzle-orm';
import { moveTagCoreOrRxnCountsBy1, selectTagOrCoreTxtRowsToDelete } from '.';
import { type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
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
	useLocalDb: boolean,
) => {
	let baseInput = await getWhoObj();
	return useLocalDb
		? _deletePost(await gsdb(), fullPostIdObj, version)
		: trpc().deletePost.mutate({ ...baseInput, fullPostIdObj, version });
};

export let _deletePost = async (db: Database, fullPostIdObj: FullIdObj, version: null | number) => {
	let deleteAllVersions = version === null;
	let partsToInsert: PartInsert[] = [];

	let mainPIdWNumAsLastVersionAtPPIdRowsFilter = and(
		pf.atId(fullPostIdObj),
		pf.id(fullPostIdObj),
		pf.code.eq(pc.postId__parentPostId_lastVersion),
		pf.txt.isNull,
	);
	let postId__bumpedRootIdRowsFilter = and(
		pf.id(fullPostIdObj),
		pf.code.eq(pc.postId__bumpedRootId),
		pf.num.isNull,
		pf.txt.isNull,
	);

	let {
		[pc.postId__parentPostId_lastVersion]: mainPIdWNumAsLastVersionAtPPIdRows = [],
		[pc.postId__bumpedRootId]: postId__bumpedRootIdRows = [],
		[pc.currentPostTagId__postId_version]: curPostTagIdWNumAsVersionAtPIdRowsToDelete = [],
		[pc.exPostTagId__postId_version]: exPostTagIdWithNumAsVersionAtPostIdRows = [],
		[pc.currentPostCoreId__postId_version]: currentPostCoreId__postId_versionRowsToDelete = [],
		[pc.exPostCoreId__postId_version]: exPostCoreIdWithNumAsVersionAtPostIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					mainPIdWNumAsLastVersionAtPPIdRowsFilter,
					postId__bumpedRootIdRowsFilter,
					and(
						pf.idAsAtId(fullPostIdObj),
						pf.ms.gt0,
						or(
							pf.code.eq(pc.currentPostTagId__postId_version),
							pf.code.eq(pc.exPostTagId__postId_version),
							pf.code.eq(pc.currentPostCoreId__postId_version),
							pf.code.eq(pc.exPostCoreId__postId_version),
						),
						version === null ? undefined : pf.num.eq(version),
						pf.txt.isNull,
					),
				),
			),
	);

	console.log('mainPIdWNumAsLastVersionAtPPIdRows:', mainPIdWNumAsLastVersionAtPPIdRows);
	let mainPIdWNumAsLastVersionAtPPIdRow = assert1Row(mainPIdWNumAsLastVersionAtPPIdRows);
	let lastVersion = mainPIdWNumAsLastVersionAtPPIdRow.num;
	let versionIsLastVersion = version === lastVersion;
	if (!lastVersion && versionIsLastVersion && !deleteAllVersions) deleteAllVersions = true;

	if (deleteAllVersions || versionIsLastVersion) {
		await moveTagCoreOrRxnCountsBy1(
			db,
			curPostTagIdWNumAsVersionAtPIdRowsToDelete,
			currentPostCoreId__postId_versionRowsToDelete,
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
					pf.code.eq(pc.postId__parentPostId_lastVersion),
					pf.num.gte0,
					pf.txt.isNull,
				),
			)
			.limit(1)
	).length;

	let postId__bumpedRootIdRow = assertLt2Rows(postId__bumpedRootIdRows);
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
							pf.code.eq(pc.childPostId__rootId_depth),
							pf.num.gte0,
						),
					]),
			and(
				pf.idAsAtId(fullPostIdObj),
				or(
					...[
						pc.ms__postId_currentVersion,
						pc.ms__postId_exVersion,
						pc.ms__postId_currentSoftDeletedVersion,
						pc.ms__postId_exSoftDeletedVersion,
						pc.currentPostTagId__postId_version,
						pc.exPostTagId__postId_version,
						pc.currentPostCoreId__postId_version,
						pc.exPostCoreId__postId_version,
					].map((c) => pf.code.eq(c)),
				),
				pf.num.gte0,
			),
		);
		if (postId__bumpedRootIdRow) {
			deleteFilters.push(postId__bumpedRootIdRowsFilter);
			let previousChildPostIdAtBumpRootIdObj = (
				await db
					.select()
					.from(pTable)
					.where(
						and(
							pf.atId(postId__bumpedRootIdRow),
							pf.notId(fullPostIdObj),
							pf.code.eq(pc.childPostId__rootId_depth),
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
								...getAtIdObj(postId__bumpedRootIdRow),
								...getAtIdObjAsIdObj(postId__bumpedRootIdRow),
							}),
					code: pc.postId__bumpedRootId,
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
		currentPostCoreId__postId_versionRowsToDelete.length ||
		exPostCoreIdWithNumAsVersionAtPostIdRows.length;
	let {
		[pc.tagId8_count_txt]: num0tagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8_count_txt]: num0coreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		checkForNum0Tags || checkForNum0Cores
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							checkForNum0Tags
								? and(
										pf.noAtId,
										pf.ms.gt0,
										or(
											...makePartsUniqueById([
												...curPostTagIdWNumAsVersionAtPIdRowsToDelete,
												...exPostTagIdWithNumAsVersionAtPostIdRows,
											]).map((r) => pf.id(r)),
										),
										pf.code.eq(pc.tagId8_count_txt),
										pf.num.eq0,
										pf.txt.isNotNull,
									)
								: undefined,
							checkForNum0Cores
								? and(
										pf.noAtId,
										pf.ms.gt0,
										or(
											...makePartsUniqueById([
												...currentPostCoreId__postId_versionRowsToDelete,
												...exPostCoreIdWithNumAsVersionAtPostIdRows,
											]).map((r) => pf.id(r)),
										),
										pf.code.eq(pc.coreId8_count_txt),
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
