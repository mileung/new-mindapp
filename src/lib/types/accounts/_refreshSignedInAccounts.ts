import { tdb } from '$lib/server/db';
import {
	deleteExpiredAuthRows,
	deleteSessionKeyCookie,
	getValidAuthCookie,
} from '$lib/server/sessions';
import type { Context } from '$lib/trpc/context';
import { and, or } from 'drizzle-orm';
import { reduceAccountRows, type MyAccountUpdates } from '.';
import { channelPartsByCode, type GranularTxtProp } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _refreshSignedInAccounts = async (
	ctx: Context,
	input: {
		callerTimestamps: {
			email: GranularTxtProp;
			name: GranularTxtProp;
			bio: GranularTxtProp;
			savedTags: GranularTxtProp;
		};
		accountMss: number[];
	},
) => {
	let currentAccountUpdates: undefined | MyAccountUpdates;
	let signedInAccountMss: undefined | number[];
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	if (sessionKey) {
		let currentAccountMs = input.accountMss[0];
		let {
			[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],
			[pc.emailTxtMsAtAccountId]: emailMsTxtAtAccountIdRows = [],
			[pc.nameTxtMsAtAccountId]: nameMsTxtAtAccountIdRows = [],
			[pc.bioTxtMsAtAccountId]: bioMsTxtAtAccountIdRows = [],
			[pc.savedTagsTxtMsAtAccountId]: savedTagsMsTxtAtAccountIdRows = [],
		} = channelPartsByCode(
			await tdb
				.select()
				.from(pTable)
				.where(
					or(
						and(
							or(...input.accountMss.map((ms) => pf.at_ms.eq(ms))),
							pf.at_by_ms.eq0,
							pf.at_in_ms.eq0,
							pf.ms.eq(sessionKey.ms),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
							pf.num.eq0,
							pf.txt.eq(sessionKey.txt),
						),
						and(
							pf.at_ms.eq(currentAccountMs),
							pf.at_by_ms.eq0,
							pf.at_in_ms.eq0,
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.emailTxtMsAtAccountId),
							pf.num.eq0,
							or(
								pf.ms.gt(input.callerTimestamps.email.ms),
								pf.txt.notEq(input.callerTimestamps.email.txt),
							),
						),
						and(
							pf.at_ms.eq(currentAccountMs),
							pf.at_by_ms.eq0,
							pf.at_in_ms.eq0,
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.nameTxtMsAtAccountId),
							pf.num.eq0,
							or(
								pf.ms.gt(input.callerTimestamps.name.ms),
								pf.txt.notEq(input.callerTimestamps.name.txt),
							),
						),
						and(
							pf.at_ms.eq(currentAccountMs),
							pf.at_by_ms.eq0,
							pf.at_in_ms.eq0,
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.bioTxtMsAtAccountId),
							pf.num.eq0,
							or(
								pf.ms.gt(input.callerTimestamps.bio.ms),
								pf.txt.notEq(input.callerTimestamps.bio.txt),
							),
						),
						and(
							pf.at_ms.eq(currentAccountMs),
							pf.at_by_ms.eq0,
							pf.at_in_ms.eq0,
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.savedTagsTxtMsAtAccountId),
							pf.num.eq0,
							or(
								pf.ms.gt(input.callerTimestamps.savedTags.ms),
								pf.txt.notEq(input.callerTimestamps.savedTags.txt),
							),
						),
					),
				),
		);
		signedInAccountMss = sessionKeyTxtMsAtAccountIdRows.map((r) => r.at_ms);
		if (signedInAccountMss.length && currentAccountMs === signedInAccountMss[0]) {
			currentAccountUpdates = reduceAccountRows([
				...emailMsTxtAtAccountIdRows,
				...nameMsTxtAtAccountIdRows,
				...bioMsTxtAtAccountIdRows,
				...savedTagsMsTxtAtAccountIdRows,
			]);
		} else deleteSessionKeyCookie(ctx);
	} else await deleteExpiredAuthRows();
	return { currentAccountUpdates, signedInAccountMss };
};
