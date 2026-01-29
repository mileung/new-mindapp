import { tdb } from '$lib/server/db';
import {
	deleteExpiredAuthRows,
	deleteSessionKeyCookie,
	getValidAuthCookie,
} from '$lib/server/sessions';
import type { Context } from '$lib/trpc/context';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _checkSignedInAccountMss = async (ctx: Context, input: { accountMss: number[] }) => {
	let signedInAccountMss: number[] = [];
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	if (sessionKey) {
		let sessionKeyTxtMsAtAccountIdRows = await tdb
			.select()
			.from(pTable)
			.where(
				and(
					or(...input.accountMss.map((ms) => pf.msAsAtId(ms))),
					pf.msAsId(sessionKey.ms),
					pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
					pf.num.eq0,
					pf.txt.eq(sessionKey.txt),
				),
			);
		signedInAccountMss = sessionKeyTxtMsAtAccountIdRows.map((r) => r.at_ms);
		if (!signedInAccountMss.length) deleteSessionKeyCookie(ctx);
	} else await deleteExpiredAuthRows();
	return { signedInAccountMss };
};
