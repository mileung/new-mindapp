import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _changeSpaceName = async (input: WhoWhereObj & { newName: string }) => {
	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({ ms, by_ms: input.callerMs, txt: input.newName })
		.where(
			and(
				pf.noParent,
				pf.ms.gt0,
				pf.by_ms.gt0,
				pf.in_ms.eq(input.spaceMs),
				pf.code.eq(pc.spaceNameIdTxt),
				pf.num.eq0,
			),
		);

	return { ms };
};
