import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _changeSpaceName = async (input: WhoWhereObj & { nameTxt: string }) => {
	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({ ms, by_ms: input.callerMs, txt: input.nameTxt })
		.where(
			and(
				pf.noParent,
				pf.ms.gt0,
				pf.by_ms.gt0,
				pf.in_ms.eq(input.spaceMs),
				pf.code.eq(pc.spaceNameTxtId),
				pf.num.eq0,
			),
		);

	return { ms };
};
