import { trpc } from '$lib/trpc/client';
import { and, eq, or } from 'drizzle-orm';
import { type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, assertLt2Rows, channelPartsByCode, getWhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdStr, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let getPostHistory = async (postIdObj: IdObj, version: number) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getPostHistory.query({ ...baseInput, postIdObj, version })
		: _getPostHistory(await gsdb(), postIdObj, version);
};

// TODO: paginate history versions?
export let _getPostHistory = async (db: Database, postIdObj: IdObj, version: number) => {
	let {
		[pc.exVersionNumMsAtPostId]: exVersionNumAndMsAtPostIdRows = [],
		[pc.exPostTagIdWithVersionNumAtPostId]: exPostTagIdWithNumAsVersionAtPostIdRows = [],
		[pc.exPostCoreIdWithVersionNumAtPostId]: exPostCoreIdWithNumAsVersionAtPostIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pf.idAsAtId(postIdObj),
					or(
						...[
							pc.exVersionNumMsAtPostId,
							pc.exPostTagIdWithVersionNumAtPostId,
							pc.exPostCoreIdWithVersionNumAtPostId,
						].map((code) => pf.code.eq(code)),
					),
					eq(pTable.num, version),
				),
			),
	);

	let exVersionNumAndMsAtPostIdRow = assert1Row(exVersionNumAndMsAtPostIdRows);
	assertLt2Rows(exPostCoreIdWithNumAsVersionAtPostIdRows);

	let {
		[pc.tagId8AndTxtWithNumAsCount]: tagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8AndTxtWithNumAsCount]: coreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		exPostTagIdWithNumAsVersionAtPostIdRows.length ||
			exPostCoreIdWithNumAsVersionAtPostIdRows.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								pf.noAtId,
								or(...exPostTagIdWithNumAsVersionAtPostIdRows.map((row) => pf.id(row))),
								pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
								pf.num.gte0,
								pf.txt.isNotNull,
							),
							and(
								pf.noAtId,
								or(...exPostCoreIdWithNumAsVersionAtPostIdRows.map((row) => pf.id(row))),
								pf.code.eq(pc.coreId8AndTxtWithNumAsCount),
								pf.num.gte0,
								pf.txt.isNotNull,
							),
						),
					)
			: [],
	);

	let parts = [
		...exPostTagIdWithNumAsVersionAtPostIdRows,
		...exPostCoreIdWithNumAsVersionAtPostIdRows,
		...tagIdAndTxtWithNumAsCountRows,
		...coreIdAndTxtWithNumAsCountRows,
	];
	let tagIdToTxtMap: Record<string, string> = {};
	let coreIdToTxtMap: Record<string, string> = {};
	let history: Post['history'] = {
		[version]: { ms: exVersionNumAndMsAtPostIdRow.ms, tags: [], core: '' },
	};

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		if (part.code === pc.exPostTagIdWithVersionNumAtPostId) {
			history[version]!.tags = [getIdStr(part), ...(history[version]!.tags || [])];
		} else if (part.code === pc.exPostCoreIdWithVersionNumAtPostId) {
			history[version]!.core = getIdStr(part);
		} else if (part.code === pc.tagId8AndTxtWithNumAsCount) {
			tagIdToTxtMap[getIdStr(part)] = part.txt!;
		} else if (part.code === pc.coreId8AndTxtWithNumAsCount) {
			coreIdToTxtMap[getIdStr(part)] = part.txt!;
		}
	}

	if (history[version]?.tags?.length) {
		for (let i = 0; i < history[version].tags.length; i++) {
			history[version].tags[i] = tagIdToTxtMap[history[version].tags[i]];
		}
	}
	if (history[version]?.core) {
		history[version].core = coreIdToTxtMap[history[version].core];
	}

	return { history };
};
