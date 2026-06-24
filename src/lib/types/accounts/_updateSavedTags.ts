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
	let now = Date.now();
	await tdb
		.update(pTable)
		.set({
			txt: JSON.stringify(input.savedTags),
			p2: now,
		})
		.where(and(pf.code.eq(pc._accountSavedTags_bm), pf.p1.eq(input.callerMs)));
	return { ms: now };
};
