import { ranStr, throwIf } from '$lib/js';
import { tdb } from '$lib/server/db';
import { week } from '$lib/time';
import { type Context } from '$lib/trpc/context';
import { reduceMyAccountRows, type MyAccount } from '$lib/types/accounts';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartInsert,
	type PartSelect,
} from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
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
	let _accountEmail_bmRow = assertLt2Rows(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc._accountEmail_bm),
					pf.txt.eq(email), //
				),
			),
	);
	throwIf(!_accountEmail_bmRow);
	let accountMs = _accountEmail_bmRow!.p1!;
	let now = Date.now();
	let _accountPwHash_bmRow: PartSelect;
	let _accountPwHash_bmFilter = and(
		pf.code.eq(pc._accountPwHash_bm),
		pf.p1.eq(accountMs), //
	);
	if (input.resetPassword) {
		throwIf(!otpVerified);
		_accountPwHash_bmRow = (
			await tdb
				.update(pTable)
				.set({
					txt: await argon2.hash(input.password),
					p2: now,
				})
				.where(_accountPwHash_bmFilter)
				.returning()
		)[0];
	} else {
		_accountPwHash_bmRow = assert1Row(
			await tdb.select().from(pTable).where(_accountPwHash_bmFilter),
		);
		throwIf(!(await argon2.verify(_accountPwHash_bmRow.txt!, input.password)));
	}
	let clientIdObj = getValidAuthCookie(ctx, 'ms_clientKey');
	let _clientKey_m_accountMsRow = assertLt2Rows(
		clientIdObj
			? await tdb
					.select()
					.from(pTable)
					.where(
						and(
							pf.code.eq(pc._clientKey_m_accountMs),
							pf.txt.eq(clientIdObj.txt),
							pf.p1.eq(clientIdObj.ms),
							pf.p2.eq(accountMs),
						),
					)
			: [],
	);
	let partsToInsert: PartInsert[] = [];
	if (!_clientKey_m_accountMsRow) {
		if (otpVerified) {
			clientIdObj = { ms: now, txt: ranStr() };
			setCookie(ctx, 'ms_clientKey', clientIdObj);
			partsToInsert.push({
				code: pc._clientKey_m_accountMs,
				txt: clientIdObj.txt,
				p1: clientIdObj.ms,
				p2: accountMs,
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
		[pc._sessionKey_m_accountMs_expiryMs]: _sessionKey_m_accountMs_expiryMsRows = [],
		[pc._accountSavedTags_bm]: _accountSavedTags_bmRows = [],
		[pc._accountEmail_bm]: _accountEmail_bmRows = [],
		[pc._accountName_bm]: _accountName_bmRows = [],
		[pc._accountBio_bm]: _accountBio_bmRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					sessionIdObj
						? and(
								pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
								pf.txt.eq(sessionIdObj.txt),
								pf.p1.eq(sessionIdObj.ms),
								pf.p2.eq(accountMs),
								pf.p3.eq0,
							)
						: undefined,
					and(
						or(
							pf.code.eq(pc._accountSavedTags_bm),
							pf.code.eq(pc._accountEmail_bm),
							pf.code.eq(pc._accountName_bm),
							pf.code.eq(pc._accountBio_bm),
						),
						pf.p1.eq(accountMs),
					),
				),
			),
	);
	if (!_sessionKey_m_accountMs_expiryMsRows.length) {
		if (!sessionIdObj) {
			sessionIdObj = { ms: now, txt: ranStr() };
			setCookie(ctx, 'ms_sessionKey', sessionIdObj);
		}
		partsToInsert.push({
			code: pc._sessionKey_m_accountMs_expiryMs,
			txt: sessionIdObj.txt,
			p1: sessionIdObj.ms,
			p2: accountMs,
			p3: now + week,
		});
	}
	let account = reduceMyAccountRows(
		[
			..._accountSavedTags_bmRows,
			..._accountEmail_bmRows,
			..._accountName_bmRows,
			..._accountBio_bmRows,
		],
		accountMs,
	);
	if (partsToInsert.length) await tdb.insert(pTable).values(partsToInsert);
	return { account };
};
