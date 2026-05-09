import { tdb } from '$lib/server/db';
import { id0 } from '$lib/types/parts/partIds';
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
	// let partCode = input.isSpace ? pc.banIdAtSpaceId : pc.banIdAtAccountId;
	let banRowFilter = and(
		pf.atId({ at_ms: input.accountMs }),
		pf.code.eq(pc.banMsByMsAtAccountId),
		pf.num.eq0,
	);

	let ms = Date.now();
	if (input.banned) {
		if (!(await tdb.select().from(pTable).where(banRowFilter)).length) {
			await tdb.insert(pTable).values({
				...id0,
				at_ms: input.accountMs,
				ms,
				by_ms: input.callerMs,
				code: pc.banMsByMsAtAccountId,
				num: 0,
			});
			await tdb
				.delete(pTable)
				.where(
					or(
						...getExpiredRowsFilters(ms),
						and(
							pf.atId({ at_ms: input.accountMs }),
							or(
								pf.code.eq(pc.clientKeyTxtMsAtAccountId),
								pf.code.eq(pc.sessionKeyTxtMs_ExpiryMs_AtAccountId),
							),
							pf.txt.isNotNull,
						),
					),
				);
		}
	} else await tdb.delete(pTable).where(banRowFilter);

	return { ms };
};
