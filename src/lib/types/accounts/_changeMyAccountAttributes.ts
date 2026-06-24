import { tdb } from '$lib/server/db';
import { type WhoObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _changeMyAccountAttributes = async (
	input: WhoObj & {
		nameTxt?: string;
		bioTxt?: string; //
	},
) => {
	let now = Date.now();
	if (input.nameTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				txt: input.nameTxt,
				p2: now, //
			})
			.where(
				and(
					pf.code.eq(pc._accountName_bm),
					pf.p1.eq(input.callerMs), //
				),
			);
	}
	if (input.bioTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				txt: input.bioTxt,
				p2: now, //
			})
			.where(
				and(
					pf.code.eq(pc._accountBio_bm),
					pf.p1.eq(input.callerMs), //
				),
			);
	}

	return { ms: now };
};
