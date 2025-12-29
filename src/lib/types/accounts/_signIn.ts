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
import { getValidClientCookies, getValidSessionCookies, setCookie } from '../../server/sessions';
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
			partCode: pc.signInOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount,
		});
		if (res.strike || res.expiredOtp) return res;
		otpVerified = true;
	}
	let emailRow = await _getEmailRow(input.email);
	if (!emailRow) return { fail: true };
	let accountMs = emailRow!.at_ms!;
	let pwHashRow = assert1Row(
		await tdb.select().from(pTable).where(filterAccountPwHashRow(accountMs)),
	);
	if (!(await argon2.verify(pwHashRow.txt!, input.password))) return { fail: true };

	let ms = Date.now();
	let { clientMs, clientKey } = getValidClientCookies(ctx);

	let clientKeyTxtMsAtAccountIdRows =
		clientMs && clientKey
			? await tdb
					.select()
					.from(pTable)
					.where(
						and(
							pf.at_ms.eq(accountMs),
							pf.at_by_ms.eq0,
							pf.at_in_ms.eq0,
							pf.ms.eq(clientMs),
							pf.by_ms.eq0,
							pf.in_ms.eq0,
							pf.code.eq(pc.clientKeyTxtMsAtAccountId),
							pf.num.eq0,
							pf.txt.eq(clientKey),
						),
					)
			: [];
	let clientKeyTxtMsAtAccountIdRow = assertLt2Rows(clientKeyTxtMsAtAccountIdRows);
	let partsToInsert: PartInsert[] = [];
	if (!clientKeyTxtMsAtAccountIdRow) {
		if (otpVerified) {
			clientKey = ranStr();
			setCookie(ctx, 'clientMs', '' + ms);
			setCookie(ctx, 'clientKey', clientKey);
			partsToInsert.push({
				...id0,
				at_ms: accountMs,
				ms,
				code: pc.clientKeyTxtMsAtAccountId,
				num: 0,
				txt: clientKey,
			});
		} else {
			return await _sendOtp({
				...input,
				partCode: pc.signInOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount,
			});
		}
	}
	let { sessionMs, sessionKey } = getValidSessionCookies(ctx);
	let {
		[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],
		[pc.emailMsTxtAtAccountId]: emailMsTxtAtAccountIdRows = [],
		[pc.nameMsTxtAtAccountId]: nameMsTxtAtAccountIdRows = [],
		[pc.bioMsTxtAtAccountId]: bioMsTxtAtAccountIdRows = [],
		[pc.savedTagsMsTxtAtAccountId]: savedTagsMsTxtAtAccountIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					sessionMs
						? and(
								pf.at_ms.eq(accountMs),
								pf.at_by_ms.eq0,
								pf.at_in_ms.eq0,
								pf.ms.eq(sessionMs),
								pf.by_ms.eq0,
								pf.in_ms.eq0,
								pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
								pf.num.eq0,
								// omitting pf.txt.eq(sessionKey) since this check is to see if
								// there is a primary key conflict. txt is not part of pk
							)
						: undefined,
					and(
						pf.at_ms.eq(accountMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt0,
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.emailMsTxtAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.at_ms.eq(accountMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt0,
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.nameMsTxtAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.at_ms.eq(accountMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt0,
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.bioMsTxtAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.at_ms.eq(accountMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt0,
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.savedTagsMsTxtAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			),
	);
	if (!sessionMs || !sessionKey) {
		sessionMs = ms;
		sessionKey = ranStr();
		setCookie(ctx, 'sessionMs', '' + sessionMs);
		setCookie(ctx, 'sessionKey', sessionKey);
	}
	if (!sessionKeyTxtMsAtAccountIdRows.length) {
		partsToInsert.push({
			...id0,
			at_ms: accountMs,
			ms: sessionMs,
			code: pc.sessionKeyTxtMsAtAccountId,
			num: 0,
			txt: sessionKey,
		});
	}
	let account = reduceMyAccountRows([
		{
			...id0,
			ms: accountMs,
			code: pc.accountId,
			num: 0,
		},
		...emailMsTxtAtAccountIdRows,
		...nameMsTxtAtAccountIdRows,
		...bioMsTxtAtAccountIdRows,
		...savedTagsMsTxtAtAccountIdRows,
	]);
	if (partsToInsert.length) await tdb.insert(pTable).values(partsToInsert).returning();
	return { account };
};
