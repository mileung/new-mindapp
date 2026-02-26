import { tdb } from '$lib/server/db';
import { assertLt2Rows } from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';

export let _getEmailRow = async (email: string) =>
	assertLt2Rows(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.by_ms.gt0,
					pf.in_ms.eq0,
					pf.code.eq(pc.accountEmailTxtMsByMs),
					pf.num.eq0,
					pf.txt.eq(email),
				),
			),
	);
