import { trpc } from '$lib/trpc/client';
import { and, or, type SQL } from 'drizzle-orm';
import { moveTagCoreOrRxnCountsBy1, selectTagOrCoreTxtRowsToDelete } from '.';
import { gsdb, type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	getBaseInput,
	hasParent,
	makePartsUniqueById,
	type PartInsert,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getAtIdObj, getAtIdObjAsIdObj, getFullIdObj, type FullIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let deletePost = async (
	fullPostIdObj: FullIdObj,
	version: null | number,
	forceUsingLocalDb?: boolean,
) => {
	let baseInput = await getBaseInput();
	return forceUsingLocalDb || !baseInput.spaceMs
		? _deletePost(await gsdb(), fullPostIdObj, version)
		: trpc().deletePost.mutate({ ...baseInput, fullPostIdObj, version });
};

export let _deletePost = async (db: Database, fullPostIdObj: FullIdObj, version: null | number) => {
	let deleteAllVersions = version === null;
	let partsToInsert: PartInsert[] = [];

	let mainPIdWNumAsLastVersionAtPPIdObjsFilter = and(
		pt.atId(fullPostIdObj),
		pt.id(fullPostIdObj),
		pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
		pt.txt.isNull,
	);
	let postIdAtBumpedRootIdObjsFilter = and(
		pt.id(fullPostIdObj),
		pt.code.eq(pc.postIdAtBumpedRootId),
		pt.num.eq0,
		pt.txt.isNull,
	);

	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: mainPIdWNumAsLastVersionAtPPIdObjs = [],
		[pc.postIdAtBumpedRootId]: postIdAtBumpedRootIdObjs = [],
		[pc.currentPostTagIdWithNumAsVersionAtPostId]: curPostTagIdWNumAsVersionAtPIdObjsToDelete = [],
		[pc.exPostTagIdWithNumAsVersionAtPostId]: exPostTagIdWithNumAsVersionAtPostIdObjs = [],
		[pc.currentPostCoreIdWithNumAsVersionAtPostId]: curPostCoreIdWNumAsVrsnAtPIdObjsToDelete = [],
		[pc.exPostCoreIdWithNumAsVersionAtPostId]: exPostCoreIdWithNumAsVersionAtPostIdObjs = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					mainPIdWNumAsLastVersionAtPPIdObjsFilter,
					postIdAtBumpedRootIdObjsFilter,
					and(
						pt.idAsAtId(fullPostIdObj),
						pt.ms.gt0,
						or(
							pt.code.eq(pc.currentPostTagIdWithNumAsVersionAtPostId),
							pt.code.eq(pc.exPostTagIdWithNumAsVersionAtPostId),
							pt.code.eq(pc.currentPostCoreIdWithNumAsVersionAtPostId),
							pt.code.eq(pc.exPostCoreIdWithNumAsVersionAtPostId),
						),
						version === null ? undefined : pt.num.eq(version),
						pt.txt.isNull,
					),
				),
			),
	);

	let mainPIdWNumAsLastVersionAtPPIdObj = assert1Row(mainPIdWNumAsLastVersionAtPPIdObjs);
	let lastVersion = mainPIdWNumAsLastVersionAtPPIdObj.num!;
	let versionIsLastVersion = version === lastVersion;
	if (!lastVersion && versionIsLastVersion && !deleteAllVersions) deleteAllVersions = true;

	if (deleteAllVersions || versionIsLastVersion) {
		await moveTagCoreOrRxnCountsBy1(
			db,
			curPostTagIdWNumAsVersionAtPIdObjsToDelete,
			curPostCoreIdWNumAsVrsnAtPIdObjsToDelete,
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
					pt.idAsAtId(fullPostIdObj),
					pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
					pt.num.gte0,
					pt.txt.isNull,
				),
			)
			.limit(1)
	).length;

	let postIdAtBumpedRootIdObj = assertLt2Rows(postIdAtBumpedRootIdObjs);
	let deleteFilters: (undefined | SQL)[] = [];

	if (deleteAllVersions) {
		postIsParent &&
			(await db.update(pTable).set({ num: 0 }).where(mainPIdWNumAsLastVersionAtPPIdObjsFilter));
		deleteFilters.push(
			...(postIsParent
				? []
				: [
						mainPIdWNumAsLastVersionAtPPIdObjsFilter,
						and(
							pt.id(fullPostIdObj), //
							pt.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							pt.num.gte0,
						),
					]),
			and(
				pt.idAsAtId(fullPostIdObj),
				or(
					...[
						pc.currentVersionNumAndMsAtPostId,
						pc.exVersionNumAndMsAtPostId,
						pc.currentSoftDeletedVersionNumAndMsAtPostId,
						pc.exSoftDeletedVersionNumAndMsAtPostId,
						pc.currentPostTagIdWithNumAsVersionAtPostId,
						pc.exPostTagIdWithNumAsVersionAtPostId,
						pc.currentPostCoreIdWithNumAsVersionAtPostId,
						pc.exPostCoreIdWithNumAsVersionAtPostId,
					].map((c) => pt.code.eq(c)),
				),
				pt.num.gte0,
			),
		);
		if (postIdAtBumpedRootIdObj) {
			deleteFilters.push(postIdAtBumpedRootIdObjsFilter);
			let previousChildPostIdAtBumpRootIdObj = (
				await db
					.select()
					.from(pTable)
					.where(
						and(
							pt.atId(postIdAtBumpedRootIdObj),
							pt.notId(fullPostIdObj),
							pt.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							pt.num.gte0,
						),
					)
					.orderBy(pt.ms.desc)
					.limit(1)
			)[0];
			hasParent(fullPostIdObj) &&
				partsToInsert.push({
					...(previousChildPostIdAtBumpRootIdObj
						? getFullIdObj(previousChildPostIdAtBumpRootIdObj)
						: {
								...getAtIdObj(postIdAtBumpedRootIdObj),
								...getAtIdObjAsIdObj(postIdAtBumpedRootIdObj),
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
		curPostTagIdWNumAsVersionAtPIdObjsToDelete.length ||
		exPostTagIdWithNumAsVersionAtPostIdObjs.length;
	let checkForNum0Cores =
		curPostCoreIdWNumAsVrsnAtPIdObjsToDelete.length ||
		exPostCoreIdWithNumAsVersionAtPostIdObjs.length;
	let {
		[pc.tagId8AndTxtWithNumAsCount]: num0tagIdAndTxtWithNumAsCountObjs = [],
		[pc.coreId8AndTxtWithNumAsCount]: num0coreIdAndTxtWithNumAsCountObjs = [],
	} = channelPartsByCode(
		checkForNum0Tags || checkForNum0Cores
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							checkForNum0Tags
								? and(
										pt.noParent,
										pt.ms.gt0,
										or(
											...makePartsUniqueById([
												...curPostTagIdWNumAsVersionAtPIdObjsToDelete,
												...exPostTagIdWithNumAsVersionAtPostIdObjs,
											]).map((r) => pt.id(r)),
										),
										pt.code.eq(pc.tagId8AndTxtWithNumAsCount),
										pt.num.eq0,
										pt.txt.isNotNull,
									)
								: undefined,
							checkForNum0Cores
								? and(
										pt.noParent,
										pt.ms.gt0,
										or(
											...makePartsUniqueById([
												...curPostCoreIdWNumAsVrsnAtPIdObjsToDelete,
												...exPostCoreIdWithNumAsVersionAtPostIdObjs,
											]).map((r) => pt.id(r)),
										),
										pt.code.eq(pc.coreId8AndTxtWithNumAsCount),
										pt.num.eq0,
										pt.txt.isNotNull,
									)
								: undefined,
						),
					)
			: [],
	);
	await selectTagOrCoreTxtRowsToDelete(
		db,
		fullPostIdObj,
		num0tagIdAndTxtWithNumAsCountObjs,
		deleteFilters,
		true,
	);
	await selectTagOrCoreTxtRowsToDelete(
		db,
		fullPostIdObj,
		num0coreIdAndTxtWithNumAsCountObjs,
		deleteFilters,
		false,
	);
	deleteFilters.length && (await db.delete(pTable).where(or(...deleteFilters)));
	partsToInsert.length && (await db.insert(pTable).values(partsToInsert));
	return { soft: postIsParent };
};
