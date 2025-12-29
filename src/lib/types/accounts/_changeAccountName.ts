import { tdb } from '$lib/server/db';
import { type WhoObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _changeAccountName = async (input: WhoObj & { newName: string }) => {
	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({ ms, txt: input.newName })
		.where(
			and(
				pf.at_ms.eq(input.callerMs),
				pf.at_by_ms.eq0,
				pf.at_in_ms.eq0,
				pf.ms.gt0,
				pf.by_ms.eq0,
				pf.in_ms.eq0,
				pf.code.eq(pc.nameMsTxtAtAccountId),
				pf.num.eq0,
			),
		);

	return { ms };
};
