import { ranStr } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { type Context } from '$lib/trpc/context';
import { filterAccountPwHashRow, reduceMyAccountRows, type MyAccount } from '$lib/types/accounts';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartInsert,
	type PartSelect,
} from '$lib/types/parts';
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
		resetPassword?: boolean;
	},
): Promise<{
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
		});
		if (res.strike || res.expiredOtp) return res;
		otpVerified = true;
	}
	let emailRow = await _getEmailRow(input.email);
	if (!emailRow) throw new Error(m.anErrorOccurred());
	let accountMs = emailRow.by_ms;
	let ms = Date.now();
	let pwHashRow: PartSelect;
	if (input.resetPassword) {
		if (!otpVerified) throw new Error(m.anErrorOccurred());
		pwHashRow = (
			await tdb
				.update(pTable)
				.set({
					ms,
					txt: await argon2.hash(input.password),
				})
				.where(filterAccountPwHashRow(emailRow!.by_ms))
				.returning()
		)[0];
	} else {
		pwHashRow = assert1Row(
			await tdb.select().from(pTable).where(filterAccountPwHashRow(accountMs)),
		);
		if (!(await argon2.verify(pwHashRow.txt!, input.password)))
			throw new Error(m.anErrorOccurred());
	}

	let clientIdObj = getValidAuthCookie(ctx, 'ms_clientKey');

	let clientIdObjTxtMsAtAccountIdRows = clientIdObj
		? await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pf.atId({ at_ms: accountMs }),
						pf.id({ ms: clientIdObj.ms }),
						pf.code.eq(pc.clientKeyTxtMsAtAccountId),
						pf.num.isNull,
						pf.txt.eq(clientIdObj.txt),
					),
				)
		: [];

	let clientIdObjTxtMsAtAccountIdRow = assertLt2Rows(clientIdObjTxtMsAtAccountIdRows);
	let partsToInsert: PartInsert[] = [];
	if (!clientIdObjTxtMsAtAccountIdRow) {
		if (otpVerified) {
			clientIdObj = { ms, txt: ranStr() };
			setCookie(ctx, 'ms_clientKey', clientIdObj);
			partsToInsert.push({
				...id0,
				at_ms: accountMs,
				ms: clientIdObj.ms,
				code: pc.clientKeyTxtMsAtAccountId,
				txt: clientIdObj.txt,
			});
		} else {
			return await _sendOtp({
				...input,
				will: { signIn: true },
			});
		}
	}

	let sessionIdObj = getValidAuthCookie(ctx, 'ms_sessionKey');
	let {
		[pc.sessionKeyTxtMs_ExpiryMs_AtAccountId]: sessionIdObjTxtMsAtAccountIdRows = [],
		[pc.accountEmailTxtMsByMs]: accountEmailTxtMsByMsRows = [],
		[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
		[pc.accountBioTxtMsByMs]: accountBioTxtMsByMsRows = [],
		[pc.accountSavedTagsTxtMsByMs]: accountSavedTagsTxtMsByMsRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					sessionIdObj
						? and(
								pf.atId({ at_ms: accountMs }),
								pf.ms.eq(sessionIdObj.ms),
								pf.in_ms.eq0,
								pf.code.eq(pc.sessionKeyTxtMs_ExpiryMs_AtAccountId),
								pf.num.isNull,
								// omitting pf.txt.eq(sessionIdObj.txt) since this check is to see if
								// there is a primary key conflict. txt is not part of pk
							)
						: undefined,
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.by_ms.eq(accountMs),
						pf.in_ms.eq0,
						or(
							pf.code.eq(pc.accountEmailTxtMsByMs),
							pf.code.eq(pc.accountNameTxtMsByMs),
							pf.code.eq(pc.accountBioTxtMsByMs),
							pf.code.eq(pc.accountSavedTagsTxtMsByMs),
						),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
				),
			),
	);
	if (!sessionIdObjTxtMsAtAccountIdRows.length) {
		if (!sessionIdObj) {
			sessionIdObj = { ms, txt: ranStr() };
			setCookie(ctx, 'ms_sessionKey', sessionIdObj);
		}
		partsToInsert.push({
			...id0,
			at_ms: accountMs,
			ms: sessionIdObj.ms,
			code: pc.sessionKeyTxtMs_ExpiryMs_AtAccountId,
			txt: sessionIdObj.txt,
		});
	}
	let account = reduceMyAccountRows([
		...accountEmailTxtMsByMsRows,
		...accountNameTxtMsByMsRows,
		...accountBioTxtMsByMsRows,
		...accountSavedTagsTxtMsByMsRows,
	]);
	if (partsToInsert.length) await tdb.insert(pTable).values(partsToInsert);
	return { account };
};
