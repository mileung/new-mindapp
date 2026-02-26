import { ranStr } from '$lib/js';
import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { type Context } from '$lib/trpc/context';
import { filterAccountPwHashRow, reduceMyAccountRows, type MyAccount } from '$lib/types/accounts';
import { assert1Row, assertLt2Rows, channelPartsByCode, type PartInsert } from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { id0 } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { and, or } from 'drizzle-orm';
import { getValidAuthCookie, setCookie } from '../../server/sessions';
import { _checkOtp } from '../otp/_checkOtp';
import { _sendOtp } from '../otp/_sendOtp';

export let _signIn = async (
	ctx: Context,
	input: {
		otpMs?: number;
		pin?: string;
		email: string;
		password: string;
	},
): Promise<{
	fail?: true;
	otpMs?: number;
	strike?: number;
	expiredOtp?: true;
	sessionMs?: number;
	account?: MyAccount;
}> => {
	let { otpMs, pin, email } = input;
	let otpVerified = false;
	if (otpMs && pin) {
		let res = await _checkOtp({
			email,
			otpMs,
			pin,
			deleteIfCorrect: true,
			partCode: pc.signInOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount,
		});
		if (res.strike || res.expiredOtp) return res;
		otpVerified = true;
	}
	let emailRow = await _getEmailRow(input.email);
	if (!emailRow) return { fail: true };
	let accountMs = emailRow.by_ms;
	let pwHashRow = assert1Row(
		await tdb.select().from(pTable).where(filterAccountPwHashRow(accountMs)),
	);
	if (!(await argon2.verify(pwHashRow.txt!, input.password))) return { fail: true };

	let ms = Date.now();
	let clientKey = getValidAuthCookie(ctx, 'clientKey');

	let clientKeyTxtMsAtAccountIdRows = clientKey
		? await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pf.atId({ at_ms: accountMs }),
						pf.id({ ms: clientKey.ms }),
						pf.code.eq(pc.clientKeyTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.eq(clientKey.txt),
					),
				)
		: [];
	let clientKeyTxtMsAtAccountIdRow = assertLt2Rows(clientKeyTxtMsAtAccountIdRows);
	let partsToInsert: PartInsert[] = [];
	if (!clientKeyTxtMsAtAccountIdRow) {
		if (otpVerified) {
			clientKey = { ms, txt: ranStr() };
			setCookie(ctx, 'clientKey', JSON.stringify(clientKey));
			partsToInsert.push({
				...id0,
				at_ms: accountMs,
				ms: clientKey.ms,
				code: pc.clientKeyTxtMsAtAccountId,
				num: 0,
				txt: clientKey.txt,
			});
		} else {
			return await _sendOtp({
				...input,
				partCode: pc.signInOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount,
			});
		}
	}
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	let {
		[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],
		[pc.accountEmailTxtMsByMs]: emailTxtMsAtAccountIdRows = [],
		[pc.accountNameTxtMsByMs]: nameTxtMsAtAccountIdRows = [],
		[pc.accountBioTxtMsByMs]: bioTxtMsAtAccountIdRows = [],
		[pc.accountSavedTagsTxtMsByMs]: savedTagsTxtMsAtAccountIdRows = [],
		[pc.accountSpaceMssTxtMsByMs]: spaceMssTxtMsAtAccountIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					sessionKey
						? and(
								pf.atId({ at_ms: accountMs }),
								pf.id({ ms: sessionKey.ms }),
								pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
								pf.num.eq0,
								// omitting pf.txt.eq(sessionKey.txt) since this check is to see if
								// there is a primary key conflict. txt is not part of pk
							)
						: undefined,
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.by_ms.eq(accountMs),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountEmailTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.by_ms.eq(accountMs),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountNameTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.by_ms.eq(accountMs),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountBioTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.by_ms.eq(accountMs),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountSavedTagsTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			),
	);
	if (!sessionKey) {
		sessionKey = { ms, txt: ranStr() };
		setCookie(ctx, 'sessionKey', JSON.stringify(sessionKey));
	}
	if (!sessionKeyTxtMsAtAccountIdRows.length) {
		partsToInsert.push({
			...id0,
			at_ms: accountMs,
			ms: sessionKey.ms,
			code: pc.sessionKeyTxtMsAtAccountId,
			num: 0,
			txt: sessionKey.txt,
		});
	}
	let account = reduceMyAccountRows([
		...emailTxtMsAtAccountIdRows,
		...nameTxtMsAtAccountIdRows,
		...bioTxtMsAtAccountIdRows,
		...savedTagsTxtMsAtAccountIdRows,
		...spaceMssTxtMsAtAccountIdRows,
	]);
	if (partsToInsert.length) await tdb.insert(pTable).values(partsToInsert).returning();
	return { account };
};
