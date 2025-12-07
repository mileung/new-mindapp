import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import { gsdb } from '../../local-db';
import { getBaseInput, type BaseInput } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let tagsPerLoad = 88;

export let getSpaceTags = async (fromCount: number, excludeTags: string[]) => {
	let baseInput = await getBaseInput();
	return baseInput.spaceMs
		? trpc().getSpaceTags.query({ ...baseInput, fromCount, excludeTags })
		: _getSpaceTags(await gsdb(), { ...baseInput, fromCount, excludeTags });
};

export let _getSpaceTags = async (
	db: Database,
	input: BaseInput & {
		fromCount: number; //
		excludeTags: string[];
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));

	let tagIdAndTxtWithNumAsCountObjs = await db
		.select()
		.from(pTable)
		.where(
			and(
				pt.at_ms.eq0,
				pt.at_by_ms.eq0,
				pt.at_in_ms.eq0,
				pt.ms.gt0,
				pt.in_ms.eq(input.spaceMs),
				pt.code.eq(pc.tagId8AndTxtWithNumAsCount),
				pt.num.lte(input.fromCount),
				and(...input.excludeTags.map((t) => pt.txt.notEq(t))),
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		.limit(tagsPerLoad);

	return {
		tags: tagIdAndTxtWithNumAsCountObjs.map((r) => ({
			...getIdObj(r),
			txt: r.txt!, //
			num: r.num!,
		})),
	};
};
