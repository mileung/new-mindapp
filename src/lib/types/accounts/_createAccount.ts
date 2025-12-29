import { ranStr } from '$lib/js';
import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { getValidClientCookies, getValidSessionCookies, setCookie } from '$lib/server/sessions';
import { type Context } from '$lib/trpc/context';
import { MyAccountSchema, reduceMyAccountRows, type MyAccount } from '$lib/types/accounts';
import { pc } from '$lib/types/parts/partCodes';
import { id0 } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { _checkOtp } from '../otp/_checkOtp';
import type { PartInsert } from '../parts';

export let _createAccount = async (
	ctx: Context,
	input: {
		name: string;
		otpMs: number;
		pin: string;
		email: string;
		password: string;
	},
): Promise<{ fail?: true; strike?: number; expiredOtp?: true; account?: MyAccount }> => {
	let res = await _checkOtp({
		...input,
		deleteIfCorrect: true,
		partCode: pc.createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount,
	});
	if (res.strike || res.expiredOtp) return res;

	if (await _getEmailRow(input.email)) return { fail: true };

	let ms = Date.now();
	let myAccountRows: PartInsert[] = [
		{
			...id0,
			ms,
			code: pc.accountId,
			num: 0,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.emailMsTxtAtAccountId,
			num: 0,
			txt: input.email,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.nameMsTxtAtAccountId,
			num: 0,
			txt: input.name,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.bioMsTxtAtAccountId,
			num: 0,
			txt: '',
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.savedTagsMsTxtAtAccountId,
			num: 0,
			txt: JSON.stringify([]),
		},
	];
	let account = reduceMyAccountRows(myAccountRows);
	if (!MyAccountSchema.safeParse(account).success) throw new Error('Invalid account');

	let { clientMs, clientKey } = getValidClientCookies(ctx);
	if (!clientMs || !clientKey) {
		clientKey = ranStr();
		setCookie(ctx, 'clientMs', '' + ms);
		setCookie(ctx, 'clientKey', clientKey);
	}

	let { sessionMs, sessionKey } = getValidSessionCookies(ctx);
	if (!sessionMs || !sessionKey) {
		sessionMs = ms;
		sessionKey = ranStr();
		setCookie(ctx, 'sessionMs', '' + sessionMs);
		setCookie(ctx, 'sessionKey', sessionKey);
	}

	let partsToInsert: PartInsert[] = [
		...myAccountRows,
		{
			...id0,
			ms, // This is an account's personal space
			code: pc.spaceId,
			num: 0,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.pwHashMsTxtAtAccountId,
			num: 0,
			txt: await argon2.hash(input.password),
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.clientKeyTxtMsAtAccountId,
			num: 0,
			txt: clientKey,
		},
		{
			...id0,
			at_ms: ms,
			ms: sessionMs,
			code: pc.sessionKeyTxtMsAtAccountId,
			num: 0,
			txt: sessionKey,
		},
	];
	await tdb.insert(pTable).values(partsToInsert);
	return { account };
};
