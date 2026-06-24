import { tdb } from '$lib/server/db';
import { and, or } from 'drizzle-orm';
import { type WhoObj } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';
import { getExpiredRowsFilters } from '../sessions';

export let _setAccountBan = async (
	input: WhoObj & {
		accountMs: number;
		banned: boolean;
	},
) => {
	let accountMs_banMbFilter = and(
		pf.code.eq(pc.accountMs_banMb),
		pf.p1.eq(input.accountMs), //
	);

	let now = Date.now();
	if (input.banned) {
		if (!(await tdb.select().from(pTable).where(accountMs_banMbFilter)).length) {
			await tdb.insert(pTable).values({
				code: pc.accountMs_banMb,
				p1: input.accountMs,
				p2: now,
				p3: input.callerMs,
			});
			await tdb
				.delete(pTable)
				.where(
					or(
						...getExpiredRowsFilters(now),
						and(
							or(
								pf.code.eq(pc._clientKey_m_accountMs),
								pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
							),
							pf.p2.eq(input.accountMs),
						),
					),
				);
		}
	} else await tdb.delete(pTable).where(accountMs_banMbFilter);

	return { ms: now };
};
