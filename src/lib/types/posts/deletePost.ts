import { getWhoObj, gsdb } from '$lib/global-state.svelte';
import { trpc } from '$lib/trpc/client';
import { and, or, sql, type SQL } from 'drizzle-orm';
import { moveTagOrRxnCountsBy1 } from '.';
import { type Database } from '../../local-db';
import { assert1Row, assertLt2Rows, channelPartsByCode, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { accentCodes } from '../spaces';

export let deletePost = async (postIdObj: IdObj, useLocalDb: boolean) => {
	let baseInput = await getWhoObj();
	return useLocalDb
		? _deletePost(await gsdb(), postIdObj)
		: trpc().deletePost.mutate({ ...baseInput, postIdObj });
};

export let _deletePost = async (db: Database, postIdObj: IdObj) => {
	let postImb_parentMb_rootMb_childCountRowsFilter = and(
		pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
		pf.p1.eq(postIdObj.in_ms),
		pf.p2.eq(postIdObj.ms), //
		pf.p3.eq(postIdObj.by_ms),
	);
	let tagAndCoreFilters = [
		and(
			or(
				pf.code.eq(pc.tagImb_postMb_lastVersion),
				pf.code.eq(pc.tagImb_postMb_oldVersion), //
			),
			pf.p1.eq(postIdObj.in_ms),
			pf.p4.eq(postIdObj.ms),
			pf.p5.eq(postIdObj.by_ms),
		),
		and(
			or(
				pf.code.eq(pc._core_postImb_lastVersion_m),
				pf.code.eq(pc._core_postImb_oldVersion_m), //
			),
			pf.p1.eq(postIdObj.in_ms),
			pf.p2.eq(postIdObj.ms),
			pf.p3.eq(postIdObj.by_ms),
		),
	];

	let {
		[pc.postImb_parentMb_rootMb_childCount]: postImb_parentMb_rootMb_childCountRows = [],
		[pc.tagImb_postMb_lastVersion]: tagImb_postMb_lastVersionRows = [],
		[pc.tagImb_postMb_oldVersion]: tagImb_postMb_oldVersionRows = [],
		[pc._core_postImb_lastVersion_m]: _core_postImb_lastVersion_mRows = [],
		[pc._core_postImb_oldVersion_m]: _core_postImb_oldVersion_mRows = [],
		[pc._emoji_postImb_count]: _emoji_postImb_countRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					postImb_parentMb_rootMb_childCountRowsFilter,
					...tagAndCoreFilters, //
					and(
						// TODO: is there a way to limit this to 1 fetched _emoji_postImb_countRow?
						pf.code.eq(pc._emoji_postImb_count),
						pf.p1.eq(postIdObj.in_ms),
						pf.p2.eq(postIdObj.ms),
						pf.p3.eq(postIdObj.by_ms),
					),
				),
			),
	);

	await moveTagOrRxnCountsBy1(db, tagImb_postMb_lastVersionRows, [], false);
	let postImb_parentMb_rootMb_childCountRow = assert1Row(postImb_parentMb_rootMb_childCountRows);
	let postIsParent = !!postImb_parentMb_rootMb_childCountRow.p8;
	let postHasReactions = !!_emoji_postImb_countRows.length;
	let softDelete = postIsParent || postHasReactions;
	let deleteFilters: (undefined | SQL)[] = [];

	deleteFilters.push(
		...(softDelete
			? [] //
			: [postImb_parentMb_rootMb_childCountRowsFilter]),
		...tagAndCoreFilters,
	);

	let _tag_imBy8_countRowsWith0Count =
		tagImb_postMb_lastVersionRows.length || tagImb_postMb_oldVersionRows.length
			? await db
					.select()
					.from(pTable)
					.where(
						and(
							pf.code.eq(pc._tag_imBy8_count),
							or(
								...[
									...new Set(
										[
											...tagImb_postMb_lastVersionRows,
											...tagImb_postMb_oldVersionRows, //
										].map((r) => `${r.p2}_${r.p3}`),
									),
								].map((s) => {
									let [msStr, byMsStr] = s.split('_');
									return and(
										pf.p1.eq(postIdObj.in_ms),
										pf.p2.eq(+msStr), //
										pf.p3.eq(+byMsStr),
									);
								}),
							),
							pf.p4.eq0,
						),
					)
			: [];

	if (_tag_imBy8_countRowsWith0Count.length) {
		let tagImb_postMb_oldVersionRowsUsing0CountTags = await Promise.all(
			_tag_imBy8_countRowsWith0Count.map(
				async (_tag_imBy8_countRow) =>
					(
						await db
							.select()
							.from(pTable)
							.where(
								and(
									pf.code.eq(pc.tagImb_postMb_oldVersion),
									pf.p1.eq(postIdObj.in_ms),
									pf.p2.eq(_tag_imBy8_countRow.p2!),
									pf.p3.eq(_tag_imBy8_countRow.p3!),
									pf.p4.notEq(postIdObj.ms),
									pf.p5.notEq(postIdObj.by_ms),
								),
							)
							.limit(1)
					)[0] as undefined | PartSelect,
			),
		);
		let _tag_imBy8_countRowsToDelete = _tag_imBy8_countRowsWith0Count.filter(
			(_tag_imBy8_countRowWith0Count) =>
				!tagImb_postMb_oldVersionRowsUsing0CountTags.find(
					(r) =>
						r &&
						r.p1 === _tag_imBy8_countRowWith0Count.p1 &&
						r.p2 === _tag_imBy8_countRowWith0Count.p2 &&
						r.p3 === _tag_imBy8_countRowWith0Count.p3,
				),
		);
		_tag_imBy8_countRowsToDelete.length &&
			deleteFilters.push(
				and(
					pf.code.eq(pc._tag_imBy8_count),
					or(
						..._tag_imBy8_countRowsToDelete.map((r) =>
							and(
								pf.txt.eq(r.txt!),
								pf.p1.eq(r.p1!), //
								pf.p2.eq(r.p2!),
								pf.p3.eq(r.p3!),
							),
						),
					),
					pf.p4.eq0,
				),
			);
	}
	deleteFilters.length && (await db.delete(pTable).where(or(...deleteFilters)));
	if (!softDelete) {
		let postImb_parentMb_rootMb_childCountLastRow = assertLt2Rows(
			await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
						pf.p1.eq(postIdObj.in_ms), //
					),
				)
				.orderBy(pf.p2.desc)
				.limit(1),
		);
		let lastPostMs = postImb_parentMb_rootMb_childCountLastRow?.p2;
		await db
			.update(pTable)
			.set({ p3: accentCodes.none })
			.where(
				and(
					pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
					pf.p1.eq(postIdObj.in_ms),
					pf.p3.notEq(accentCodes.none),
					lastPostMs ? pf.p4.gt(lastPostMs) : undefined,
				),
			);
		let { p4, p5 } = postImb_parentMb_rootMb_childCountRow;
		if (Number.isInteger(p4) && Number.isInteger(p5)) {
			let atMs = p4!;
			let atByMs = p5!;
			await db
				.update(pTable)
				.set({ p8: sql`${pTable.p8} - 1` })
				.where(
					and(
						pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
						pf.p1.eq(postIdObj.in_ms),
						pf.p2.eq(atMs),
						pf.p3.eq(atByMs),
					),
				);
			let i_accountMs_accentCode_lastViewMs_sidePriorityRows = await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
						pf.p1.eq(postIdObj.in_ms),
						pf.p2.eq(atByMs),
						pf.p3.notEq(accentCodes.none),
					),
				)
				.orderBy(pf.p2.desc)
				.limit(1);
			let i_accountMs_accentCode_lastViewMs_sidePriorityRow = assertLt2Rows(
				i_accountMs_accentCode_lastViewMs_sidePriorityRows,
			);
			let lastViewMs = i_accountMs_accentCode_lastViewMs_sidePriorityRow?.p4;
			if (lastViewMs) {
				let lastPostRowIsAtByMs = postImb_parentMb_rootMb_childCountLastRow?.p5 === atByMs;
				let postImb_parentMb_rootMb_childCountAtByMsLastRow = lastPostRowIsAtByMs
					? postImb_parentMb_rootMb_childCountLastRow
					: assertLt2Rows(
							await db
								.select()
								.from(pTable)
								.where(
									or(
										and(
											pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
											pf.p1.eq(postIdObj.in_ms),
											pf.p5.eq(atByMs),
										),
									),
								)
								.orderBy(pf.p2.desc)
								.limit(1),
						);
				if (lastPostMs && lastViewMs < lastPostMs) {
					await db
						.update(pTable)
						.set({
							p3:
								postImb_parentMb_rootMb_childCountAtByMsLastRow &&
								lastViewMs < postImb_parentMb_rootMb_childCountAtByMsLastRow.p2!
									? accentCodes.newPostsForCaller
									: accentCodes.newPosts,
						})
						.where(
							and(
								pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
								pf.p1.eq(postIdObj.in_ms),
								pf.p2.eq(atByMs),
							),
						);
				}
			}
		}
	}

	return { soft: softDelete };
};
