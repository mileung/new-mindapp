import { tdb } from '$lib/server/db';
import { and } from 'drizzle-orm';
import { type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _updateSavedTags = async (
	input: WhoObj & {
		savedTags: string[];
	},
) => {
	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({
			ms,
			txt: JSON.stringify(input.savedTags),
		})
		.where(
			and(
				pf.noAtId,
				pf.ms.gt0,
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountSavedTagsTxtMsByMs),
				pf.num.eq0,
				pf.txt.isNotNull,
			),
		);
	return { ms };
};
