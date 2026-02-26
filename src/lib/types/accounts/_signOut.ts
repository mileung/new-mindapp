import { tdb } from '$lib/server/db';
import { getValidAuthCookie } from '$lib/server/sessions';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { type WhoObj } from '$lib/types/parts';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _signOut = async (ctx: Context, input: WhoObj & { everywhere: boolean }) => {
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	if (sessionKey) {
		await tdb
			.delete(pTable)
			.where(
				input.everywhere
					? or(
							and(
								pf.atId({ at_ms: input.callerMs }),
								pf.ms.gt0,
								pf.by_ms.eq0,
								pf.in_ms.eq0,
								or(
									pf.code.eq(pc.clientKeyTxtMsAtAccountId),
									pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
								),
								pf.num.eq0,
								pf.txt.isNotNull,
							),
							and(
								pf.at_ms.gt0,
								pf.at_by_ms.eq0,
								pf.at_in_ms.eq0,
								pf.ms.lte(Date.now() - week),
								pf.by_ms.eq0,
								pf.in_ms.eq0,
								or(
									pf.code.eq(pc.clientKeyTxtMsAtAccountId),
									pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
									pf.code.eq(pc.createAccountOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount),
									pf.code.eq(pc.signInOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount),
									pf.code.eq(pc.resetPasswordOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount),
								),
								pf.txt.isNotNull,
							),
						)
					: and(
							pf.atId({ at_ms: input.callerMs }),
							pf.id({ ms: sessionKey.ms }),
							pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
							pf.num.eq0,
							pf.txt.eq(sessionKey.txt),
						),
			);
	}
};
