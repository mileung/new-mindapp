import { trpc } from '$lib/trpc/client';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { gsdb } from '../../local-db';
import { getBaseInput, type BaseInput } from '../parts';
import { pTable } from '../parts/partsTable';
import { pt } from '../parts/partFilters';
import { pc } from '../parts/partCodes';
import type { Database } from '$lib/local-db';

export let getSpaceTags = async () => {
	let baseInput = getBaseInput();
	return baseInput.in_ms > 0
		? trpc().getSpaceTags.mutate(baseInput)
		: _getSpaceTags(await gsdb(), baseInput);
};

export let _getSpaceTags = async (db: Database, baseInput: BaseInput) => {
	if (baseInput.in_ms !== 0 && baseInput.in_ms !== 1 && !baseInput.by_ms)
		throw new Error('Missing byMs');
	let tagRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pt.at_ms.eq0,
				pt.at_by_ms.eq0,
				pt.at_in_ms.eq0,
				pt.ms.gt0,
				pt.in_ms.eq(baseInput.in_ms),
				pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
				isNotNull(pTable.txt),
				pt.num.isNotNull,
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		// .offset(baseInput.offset)
		.limit(88);

	return { tags: tagRows.map((r) => ({ txt: r.txt!, num: r.num! })) };
};
