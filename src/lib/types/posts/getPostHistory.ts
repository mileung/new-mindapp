import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { type Post } from '.';
import { type Database } from '../../local-db';
import { assert1Row, channelPartsByCode } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let getPostHistory = async (postIdObj: IdObj, version: number) => {
	// console.log('postIdObj:', postIdObj);
	// console.log('version:', version);
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getPostHistory.query({ ...baseInput, postIdObj, version })
		: _getPostHistory(await gsdb(), postIdObj, version);
};

// TODO: paginate history versions?
export let _getPostHistory = async (db: Database, postIdObj: IdObj, version: number) => {
	let {
		[pc._core_postImb_oldVersion_m]: _core_postImb_oldVersion_mRows = [],
		[pc.tagImb_postMb_oldVersion]: tagImb_postMb_oldVersionRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					or(pf.code.eq(pc._core_postImb_oldVersion_m), pf.code.eq(pc.tagImb_postMb_oldVersion)),
					pf.p1.eq(postIdObj.in_ms),
					pf.p2.eq(postIdObj.ms),
					pf.p3.eq(postIdObj.by_ms),
					pf.p4.eq(version),
				),
			),
	);

	let _core_postImb_oldVersion_mRow = assert1Row(_core_postImb_oldVersion_mRows);

	let _tag_imBy8_countRows = tagImb_postMb_oldVersionRows.length
		? await db
				.select()
				.from(pTable)
				.where(
					or(
						and(
							pf.code.eq(pc._tag_imBy8_count),
							or(
								...tagImb_postMb_oldVersionRows.map((r) =>
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

	let parts = [...tagImb_postMb_oldVersionRows, ..._tag_imBy8_countRows];
	let tagIdToTxtMap: Record<string, string> = {};
	let history: Post['history'] = {
		[version]: {
			ms: _core_postImb_oldVersion_mRow.p5!,
			tags: [],
			core: _core_postImb_oldVersion_mRow.txt!,
		},
	};

	for (let i = 0; i < parts.length; i++) {
		let { code, txt, p1, p2, p3 } = parts[i];
		let idStr = `${p1}_${p2}_${p3}`;
		if (code === pc.tagImb_postMb_oldVersion) {
			history[version]!.tags = [idStr, ...(history[version]!.tags || [])];
		} else if (code === pc._tag_imBy8_count) {
			tagIdToTxtMap[idStr] = txt!;
		}
	}

	if (history[version]?.tags?.length) {
		for (let i = 0; i < history[version].tags.length; i++) {
			history[version].tags[i] = tagIdToTxtMap[history[version].tags[i]];
		}
	}

	return { history };
};
