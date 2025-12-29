import { tdb } from '$lib/server/db';
import {
	deleteExpiredAuthRows,
	deleteSessionCookies,
	getValidSessionCookies,
} from '$lib/server/sessions';
import type { Context } from '$lib/trpc/context';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _checkSignedInAccountMss = async (ctx: Context, input: { accountMss: number[] }) => {
	let signedInAccountMss: number[] = [];
	let { sessionMs, sessionKey } = getValidSessionCookies(ctx);
	if (!sessionKey || !sessionMs) {
		await deleteExpiredAuthRows();
	} else if (sessionMs && sessionKey) {
		let sessionKeyTxtMsAtAccountIdRows = await tdb
			.select()
			.from(pTable)
			.where(
				and(
					or(...input.accountMss.map((ms) => pf.at_ms.eq(ms))),
					pf.at_by_ms.eq0,
					pf.at_in_ms.eq0,
					pf.ms.eq(sessionMs),
					pf.by_ms.eq0,
					pf.in_ms.eq0,
					pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
					pf.num.eq0,
					pf.txt.eq(sessionKey),
				),
			);
		signedInAccountMss = sessionKeyTxtMsAtAccountIdRows.map((r) => r.at_ms);
		if (!signedInAccountMss.length) deleteSessionCookies(ctx);
	}
	return { signedInAccountMss };
};
