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
		callerAttributes?: {
			email: GranularTxtProp;
			name: GranularTxtProp;
			bio: GranularTxtProp;
			savedTags: GranularTxtProp;
			spaceMss: GranularTxtProp;
		};
		accountMss: number[];
	},
) => {
	let currentAccountUpdates: undefined | MyAccountUpdates;
	let signedInAccountMss: undefined | number[];
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	if (input.callerAttributes && sessionKey) {
		let currentAccountMs = input.accountMss[0];
		let {
			[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],
			[pc.emailTxtMsAtAccountId]: emailTxtMsAtAccountIdRows = [],
			[pc.nameTxtMsAtAccountId]: nameTxtMsAtAccountIdRows = [],
			[pc.bioTxtMsAtAccountId]: bioTxtMsAtAccountIdRows = [],
			[pc.savedTagsTxtMsAtAccountId]: savedTagsTxtMsAtAccountIdRows = [],
			[pc.spaceMssTxtMsAtAccountId]: spaceMssTxtMsAtAccountIdRows = [],
		} = channelPartsByCode(
			await tdb
				.select()
				.from(pTable)
				.where(
					or(
						and(
							or(...input.accountMss.map((ms) => pf.msAsAtId(ms))),
							pf.msAsId(sessionKey.ms),
							pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
							pf.num.eq0,
							pf.txt.eq(sessionKey.txt),
						),
						and(
							pf.msAsAtId(currentAccountMs),
							or(
								pf.ms.gt(input.callerAttributes.email.ms),
								pf.txt.notEq(input.callerAttributes.email.txt),
							),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.emailTxtMsAtAccountId),
							pf.num.eq0,
						),
						and(
							pf.msAsAtId(currentAccountMs),
							or(
								pf.ms.gt(input.callerAttributes.name.ms),
								pf.txt.notEq(input.callerAttributes.name.txt),
							),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.nameTxtMsAtAccountId),
							pf.num.eq0,
						),
						and(
							pf.msAsAtId(currentAccountMs),
							or(
								pf.ms.gt(input.callerAttributes.bio.ms),
								pf.txt.notEq(input.callerAttributes.bio.txt),
							),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.bioTxtMsAtAccountId),
							pf.num.eq0,
						),
						and(
							pf.msAsAtId(currentAccountMs),
							or(
								pf.ms.gt(input.callerAttributes.savedTags.ms),
								pf.txt.notEq(input.callerAttributes.savedTags.txt),
							),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.savedTagsTxtMsAtAccountId),
							pf.num.eq0,
						),
						and(
							pf.msAsAtId(currentAccountMs),
							or(
								pf.ms.gt(input.callerAttributes.spaceMss.ms),
								pf.txt.notEq(input.callerAttributes.spaceMss.txt),
							),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.spaceMssTxtMsAtAccountId),
							pf.num.eq0,
						),
					),
				),
		);
		signedInAccountMss = sessionKeyTxtMsAtAccountIdRows.map((r) => r.at_ms);
		if (signedInAccountMss.length && currentAccountMs === signedInAccountMss[0]) {
			currentAccountUpdates = reduceAccountRows([
				...emailTxtMsAtAccountIdRows,
				...nameTxtMsAtAccountIdRows,
				...bioTxtMsAtAccountIdRows,
				...savedTagsTxtMsAtAccountIdRows,
				...spaceMssTxtMsAtAccountIdRows,
			]);
		} else deleteSessionKeyCookie(ctx);
	} else await deleteExpiredAuthRows();
	return { currentAccountUpdates, signedInAccountMss };
};
