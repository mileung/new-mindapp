import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import { gsdb } from '../../local-db';
import { getWhoWhereObj, type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let tagsPerLoad = 88;

export let getSpaceTags = async (fromCount: number, excludeTags: string[]) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getSpaceTags.query({ ...baseInput, fromCount, excludeTags })
		: _getSpaceTags(await gsdb(), { ...baseInput, fromCount, excludeTags });
};

export let _getSpaceTags = async (
	db: Database,
	input: WhoWhereObj & {
		fromCount: number; //
		excludeTags: string[];
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));

	let tagIdAndTxtWithNumAsCountRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.at_ms.eq0,
				pf.at_by_ms.eq0,
				pf.at_in_ms.eq0,
				pf.ms.gt0,
				pf.in_ms.eq(input.spaceMs),
				pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
				pf.num.lte(input.fromCount),
				pf.num.gt0,
				and(...input.excludeTags.map((t) => pf.txt.notEq(t))),
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		.limit(tagsPerLoad);

	return {
		tags: tagIdAndTxtWithNumAsCountRows.map((r) => ({
			...getIdObj(r),
			txt: r.txt!, //
			num: r.num!,
		})),
	};
};
