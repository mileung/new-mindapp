import { gsdb } from '$lib/global-state.svelte';
import { ranInt, throwIf } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { getLastVersion, moveTagOrRxnCountsBy1, type Post } from '.';
import { type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let editPost = async (post: Post, useLocalDb: boolean, useLastLayerMs: boolean) => {
	return useLocalDb || !post.in_ms
		? _editPost(await gsdb(), post, useLastLayerMs)
		: trpc().editPost.mutate(post);
};

export let _editPost = async (db: Database, post: Post, useLastLayerMs: boolean) => {
	let newLastVersion = getLastVersion(post);
	if (newLastVersion === null) throw new Error(`Cannot edit soft deleted posts`);
	let oldLastVersion = newLastVersion - 1;
	let {
		[pc.tagImb_postMb_lastVersion]: tagImb_postMb_lastVersionRows = [],
		[pc._core_postImb_lastVersion_m]: _core_postImb_lastVersion_mRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.code.eq(pc.tagImb_postMb_lastVersion),
						pf.p1.eq(post.in_ms),
						pf.p4.eq(post.ms),
						pf.p5.eq(post.by_ms),
						pf.p6.eq(oldLastVersion),
					),
					and(
						pf.code.eq(pc._core_postImb_lastVersion_m),
						pf.p1.eq(post.in_ms),
						pf.p2.eq(post.ms),
						pf.p3.eq(post.by_ms),
						pf.p4.eq(oldLastVersion),
					),
				),
			),
	);
	let _core_postImb_lastVersion_mRow = assert1Row(_core_postImb_lastVersion_mRows);
	throwIf(_core_postImb_lastVersion_mRow.p4! !== oldLastVersion);
	let lastLayerMs = useLastLayerMs ? post.history![newLastVersion]!.ms : Date.now();
	let newPostTagStrs = post.history![newLastVersion]!.tags;
	let newPostCoreStr = post.history![newLastVersion]!.core.trim();
	let partsToInsert: PartInsert[] = [
		{
			code: pc._core_postImb_lastVersion_m,
			txt: newPostCoreStr,
			p1: post.in_ms,
			p2: post.ms,
			p3: post.by_ms,
			p4: newLastVersion,
			p5: lastLayerMs,
		},
	];

	let _tag_imBy8_countRows =
		newPostTagStrs.length || tagImb_postMb_lastVersionRows.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								pf.code.eq(pc._tag_imBy8_count),
								or(
									...newPostTagStrs.map((s) => pf.txt.eq(s)),
									...tagImb_postMb_lastVersionRows.map((r) =>
										and(
											pf.p1.eq(r.p1!), //
											pf.p2.eq(r.p2!),
											pf.p3.eq(r.p3!),
										),
									),
								),
							),
						),
					)
			: [];

	let txt2_tag_imBy8_countRowMap: Record<string, undefined | PartInsert> = {};
	let tagIdToTxtMap: Record<string, string> = {};
	for (let i = 0; i < _tag_imBy8_countRows.length; i++) {
		let _tag_imBy8_countRow = _tag_imBy8_countRows[i];
		let { txt, p1, p2, p3 } = _tag_imBy8_countRow;
		txt2_tag_imBy8_countRowMap[txt!] = _tag_imBy8_countRow;
		tagIdToTxtMap[`${p1}_${p2}_${p3}`] = _tag_imBy8_countRow.txt!;
	}
	let _tag_imBy8_countRowsToUpCountBy1: PartInsert[] = [];
	let newTagCount = 0;
	let by8Ms = ranInt(8, 88888888);
	for (let i = 0; i < newPostTagStrs.length; i++) {
		let tagStr = newPostTagStrs[i];
		let _tag_imBy8_countRow = txt2_tag_imBy8_countRowMap[tagStr];
		if (_tag_imBy8_countRow) {
			if (
				!tagImb_postMb_lastVersionRows.find(
					(r) =>
						r.p1 === _tag_imBy8_countRow!.p1 &&
						r.p2 === _tag_imBy8_countRow!.p2 &&
						r.p2 === _tag_imBy8_countRow!.p2,
				)
			)
				_tag_imBy8_countRowsToUpCountBy1.push(_tag_imBy8_countRow);
		} else {
			_tag_imBy8_countRow = {
				code: pc._tag_imBy8_count,
				txt: tagStr,
				p1: post.in_ms,
				p2: lastLayerMs + newTagCount++,
				p3: by8Ms,
				p4: 1,
			};
			partsToInsert.push(_tag_imBy8_countRow);
		}
		partsToInsert.push({
			code: pc.tagImb_postMb_lastVersion,
			p1: _tag_imBy8_countRow.p1,
			p2: _tag_imBy8_countRow.p2,
			p3: _tag_imBy8_countRow.p3,
			p4: post.ms,
			p5: post.by_ms,
			p6: newLastVersion,
		});
	}

	let oldPostTagStrs = tagImb_postMb_lastVersionRows.map(
		(r) => tagIdToTxtMap[`${r.p1}_${r.p2}_${r.p3}`],
	);
	let removedTags = oldPostTagStrs.filter((t) => !newPostTagStrs.includes(t));
	let tagsChanged =
		!!newTagCount || !!_tag_imBy8_countRowsToUpCountBy1.length || !!removedTags.length;
	let coreChanged = newPostCoreStr !== _core_postImb_lastVersion_mRow.txt;
	throwIf(!tagsChanged && !coreChanged);
	await moveTagOrRxnCountsBy1(db, _tag_imBy8_countRowsToUpCountBy1, [], true);
	let _tag_imBy8_countRowsToDownCountBy1: PartInsert[] = [];
	for (let i = 0; i < removedTags.length; i++) {
		let tagTxtRow = txt2_tag_imBy8_countRowMap[removedTags[i]];
		if (tagTxtRow) _tag_imBy8_countRowsToDownCountBy1.push(tagTxtRow);
	}
	await moveTagOrRxnCountsBy1(db, _tag_imBy8_countRowsToDownCountBy1, [], false);
	await db
		.update(pTable)
		.set({ code: pc.tagImb_postMb_oldVersion })
		.where(
			and(
				pf.code.eq(pc.tagImb_postMb_lastVersion),
				pf.p1.eq(post.in_ms),
				pf.p4.eq(post.ms),
				pf.p5.eq(post.by_ms),
				pf.p6.eq(oldLastVersion),
			),
		);
	await db
		.update(pTable)
		.set({ code: pc._core_postImb_oldVersion_m })
		.where(
			and(
				pf.code.eq(pc._core_postImb_lastVersion_m),
				pf.p1.eq(post.in_ms),
				pf.p2.eq(post.ms),
				pf.p3.eq(post.by_ms),
				pf.p4.eq(oldLastVersion),
			),
		);
	await db.insert(pTable).values(partsToInsert);
	return { ms: lastLayerMs };
};
