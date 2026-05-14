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
	let ms = Date.now();
	if (input.nameTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({ ms, txt: input.nameTxt })
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.by_ms.eq(input.callerMs),
					pf.in_ms.eq0,
					pf.code.eq(pc.msByMs__accountName),
					pf.num.isNull,
					pf.txt.isNotNull,
				),
			);
	}
	if (input.bioTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({ ms, txt: input.bioTxt })
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.by_ms.eq(input.callerMs),
					pf.in_ms.eq0,
					pf.code.eq(pc.msByMs__accountBio),
					pf.num.isNull,
					pf.txt.isNotNull,
				),
			);
	}

	return { ms };
};
