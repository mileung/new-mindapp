import { ranStr, rulesAllowEmail, throwIf } from '$lib/js';
import { tdb } from '$lib/server/db';
import { getValidAuthCookie, setCookie } from '$lib/server/sessions';
import { week } from '$lib/time';
import { type Context } from '$lib/trpc/context';
import { MyAccountSchema, reduceMyAccountRows, type MyAccount } from '$lib/types/accounts';
import { pc } from '$lib/types/parts/partCodes';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { and, or } from 'drizzle-orm';
import { _checkOtp } from '../otp/_checkOtp';
import { assertLt2Rows, channelPartsByCode, type PartInsert } from '../parts';
import { pf } from '../parts/partFilters';
import { cleanTags } from '../posts';
import { makeNewSpaceRows } from '../spaces/_createSpace';

export let _createAccount = async (
	ctx: Context,
	input: {
		name: string;
		otpMs: number;
		pinStr: string;
		email: string;
		password: string;
	},
): Promise<{ strike?: number; expiredOtp?: true; account?: MyAccount }> => {
	let res = await _checkOtp({
		...input,
		deleteIfCorrect: true,
	});
	if (res.strike || res.expiredOtp) return res;
	let {
		[pc._accountEmail_bm]: _accountEmail_bmRows = [],
		[pc._signedInEmailRules_mb]: _signedInEmailRules_mbRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					pf.code.eq(pc._signedInEmailRules_mb),
					and(
						pf.code.eq(pc._accountEmail_bm),
						pf.txt.eq(input.email), //
					),
				),
			),
	);
	throwIf(_accountEmail_bmRows.length);
	let signedInEmailRulesTxt = assertLt2Rows(_signedInEmailRules_mbRows)?.txt ?? '';
	throwIf(
		signedInEmailRulesTxt && //
			!rulesAllowEmail(signedInEmailRulesTxt.split('\n'), input.email),
	);

	let top88MostUsedGlobalTags = cleanTags(
		(
			await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc._tag_imBy8_count),
						pf.p1.eq(1), //
					),
				)
				.orderBy(pf.p4.desc, pf.p2.desc)
				.limit(88)
		).map((r) => r.txt!, true),
	);

	let now = Date.now();
	let myAccountRows: PartInsert[] = [
		{
			code: pc._accountEmail_bm,
			txt: input.email,
			p1: now,
			p2: now,
		},
		{
			code: pc._accountName_bm,
			txt: input.name,
			p1: now,
			p2: now,
		},
		{
			code: pc._accountBio_bm,
			txt: '',
			p1: now,
			p2: now,
		},
		{
			code: pc._accountSavedTags_bm,
			txt: JSON.stringify(top88MostUsedGlobalTags),
			p1: now,
			p2: now,
		},
	];
	let account = reduceMyAccountRows(myAccountRows, now);
	if (!MyAccountSchema.safeParse(account).success) throw new Error('Invalid account');

	let clientIdObj = getValidAuthCookie(ctx, 'ms_clientKey');
	if (!clientIdObj) {
		clientIdObj = { ms: now, txt: ranStr() };
		setCookie(ctx, 'ms_clientKey', clientIdObj);
	}
	let sessionIdObj = getValidAuthCookie(ctx, 'ms_sessionKey');
	if (!sessionIdObj) {
		sessionIdObj = { ms: now, txt: ranStr() };
		setCookie(ctx, 'ms_sessionKey', sessionIdObj);
	}

	let partsToInsert: PartInsert[] = [
		...myAccountRows,
		...makeNewSpaceRows({
			spaceMs: now,
			callerMs: now,
		}),
		{
			code: pc._accountPwHash_bm,
			txt: await argon2.hash(input.password),
			p1: now,
			p2: now,
		},
		{
			code: pc._clientKey_m_accountMs,
			txt: clientIdObj.txt,
			p1: clientIdObj.ms,
			p2: now,
		},
		{
			code: pc._sessionKey_m_accountMs_expiryMs,
			txt: sessionIdObj.txt,
			p1: sessionIdObj.ms,
			p2: now,
			p3: now + week,
		},
	];
	await tdb.insert(pTable).values(partsToInsert);
	return { account };
};
