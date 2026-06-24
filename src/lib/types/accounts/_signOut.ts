import { tdb } from '$lib/server/db';
import { getExpiredRowsFilters, getValidAuthCookie } from '$lib/server/sessions';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { type WhoObj } from '$lib/types/parts';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _signOut = async (ctx: Context, input: WhoObj & { everywhere: boolean }) => {
	let sessionIdObj = getValidAuthCookie(ctx, 'ms_sessionKey');
	if (sessionIdObj) {
		let now = Date.now();
		await tdb
			.delete(pTable)
			.where(
				or(
					...getExpiredRowsFilters(now),
					input.everywhere
						? or(
								and(
									or(
										pf.code.eq(pc._clientKey_m_accountMs),
										pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
									),
									pf.p2.eq(input.callerMs),
								),
								and(
									or(
										pf.code.eq(pc._clientKey_m_accountMs),
										pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
									),
									pf.p1.lt(now - week),
								),
							)
						: and(
								pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
								pf.txt.eq(sessionIdObj.txt),
								pf.p1.eq(sessionIdObj.ms),
								pf.p2.eq(input.callerMs),
							),
				),
			);
	}
};
