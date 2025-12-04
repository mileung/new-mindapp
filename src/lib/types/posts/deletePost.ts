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
	useRpc: boolean,
) => {
	return useRpc
		? trpc().deletePost.mutate({ ...(await getBaseInput()), fullPostIdObj, version })
		: _deletePost(await gsdb(), fullPostIdObj, version);
};

export let _deletePost = async (db: Database, fullPostIdObj: FullIdObj, version: null | number) => {
	if (fullPostIdObj.in_ms > 0 && !fullPostIdObj.by_ms) throw new Error('Invalid by_ms');
	let deleteAllVersions = version === null;
	if (!deleteAllVersions && version! < 0) throw new Error(`Invalid version`);
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
		pt.txt.isNull,
		pt.num.isNull,
	);

	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: mainPIdWNumAsLastVersionAtPPIdObjs = [],
		[pc.postIdAtBumpedRootId]: postIdAtBumpedRootIdObjs = [],
		[pc.currentPostTagIdWithNumAsVersionAtPostId]: curPostTagIdWNumAsVersionAtPIdObjsToDelete = [],
		[pc.currentPostCoreIdWithNumAsVersionAtPostId]:
			curPostCoreIdWNumAsVersionAtPIdObjsToDelete = [],
		[pc.exPostTagIdWithNumAsVersionAtPostId]: exPostTagIdWithNumAsVersionAtPostIdObjs = [],
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
							pt.code.eq(pc.currentPostCoreIdWithNumAsVersionAtPostId),
							pt.code.eq(pc.exPostTagIdWithNumAsVersionAtPostId),
							pt.code.eq(pc.exPostCoreIdWithNumAsVersionAtPostId),
						),
						pt.txt.isNull,
						version === null ? undefined : pt.num.eq(version),
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
			curPostCoreIdWNumAsVersionAtPIdObjsToDelete,
			[],
			false,
		);
	}

	let postIsParent = !!(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pt.idAsAtId(fullPostIdObj),
					pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
					pt.txt.isNull,
					pt.num.isNotNull,
				),
			)
			.limit(1)
	).length;

	let postIdAtBumpedRootIdObj = assertLt2Rows(postIdAtBumpedRootIdObjs);
	let deleteFilters: (undefined | SQL)[] = [];

	if (deleteAllVersions) {
		postIsParent &&
			(await db.update(pTable).set({ num: null }).where(mainPIdWNumAsLastVersionAtPPIdObjsFilter));
		deleteFilters.push(
			...(postIsParent
				? []
				: [
						mainPIdWNumAsLastVersionAtPPIdObjsFilter,
						and(
							pt.id(fullPostIdObj), //
							pt.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							pt.num.isNotNull,
						),
					]),
			and(
				pt.idAsAtId(fullPostIdObj),
				or(
					...[
						pc.currentVersionNumAndMsAtPostId,
						pc.currentSoftDeletedVersionNumAndMsAtPostId,
						pc.exVersionNumAndMsAtPostId,
						pc.exSoftDeletedVersionNumAndMsAtPostId,
						pc.currentPostTagIdWithNumAsVersionAtPostId,
						pc.currentPostCoreIdWithNumAsVersionAtPostId,
						pc.exPostTagIdWithNumAsVersionAtPostId,
						pc.exPostCoreIdWithNumAsVersionAtPostId,
					].map((c) => pt.code.eq(c)),
				),
				pt.num.isNotNull,
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
							pt.num.isNotNull,
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
				});
		}
	} else {
		// TODO: delete specific version
		throw new Error(`cannot delete specific version yet`);
	}

	let checkForNum0Tags =
		curPostTagIdWNumAsVersionAtPIdObjsToDelete.length ||
		exPostTagIdWithNumAsVersionAtPostIdObjs.length;
	let checkForNum0Cores =
		curPostCoreIdWNumAsVersionAtPIdObjsToDelete.length ||
		exPostCoreIdWithNumAsVersionAtPostIdObjs.length;
	let {
		[pc.tagIdAndTxtWithNumAsCount]: num0tagIdAndTxtWithNumAsCountObjs = [],
		[pc.coreIdAndTxtWithNumAsCount]: num0coreIdAndTxtWithNumAsCountObjs = [],
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
										pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
										pt.txt.isNotNull,
										pt.num.eq0,
									)
								: undefined,
							checkForNum0Cores
								? and(
										pt.noParent,
										pt.ms.gt0,
										or(
											...makePartsUniqueById([
												...curPostCoreIdWNumAsVersionAtPIdObjsToDelete,
												...exPostCoreIdWithNumAsVersionAtPostIdObjs,
											]).map((r) => pt.id(r)),
										),
										pt.code.eq(pc.coreIdAndTxtWithNumAsCount),
										pt.txt.isNotNull,
										pt.num.eq0,
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
