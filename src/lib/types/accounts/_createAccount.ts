import { ranStr } from '$lib/js';
import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { getValidAuthCookie, setCookie } from '$lib/server/sessions';
import { type Context } from '$lib/trpc/context';
import { MyAccountSchema, reduceMyAccountRows, type MyAccount } from '$lib/types/accounts';
import { pc } from '$lib/types/parts/partCodes';
import { id0 } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { and } from 'drizzle-orm';
import { _checkOtp } from '../otp/_checkOtp';
import type { PartInsert } from '../parts';
import { pf } from '../parts/partFilters';
import { normalizeTags } from '../posts';

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

	let top888MostUsedGlobalTags = normalizeTags(
		(
			await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pf.at_ms.eq0,
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt0,
						pf.in_ms.eq(1),
						pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
						pf.num.gt0,
						pf.txt.isNotNull,
					),
				)
				.orderBy(pf.num.desc, pf.txt.asc)
				.limit(888)
		).map((r) => r.txt!),
	);

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
			code: pc.emailTxtMsAtAccountId,
			num: 0,
			txt: input.email,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.nameTxtMsAtAccountId,
			num: 0,
			txt: input.name,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.bioTxtMsAtAccountId,
			num: 0,
			txt: '',
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.savedTagsTxtMsAtAccountId,
			num: 0,
			txt: JSON.stringify(top888MostUsedGlobalTags),
		},
	];
	let account = reduceMyAccountRows(myAccountRows);
	if (!MyAccountSchema.safeParse(account).success) throw new Error('Invalid account');

	let clientKey = getValidAuthCookie(ctx, 'clientKey');
	if (!clientKey) {
		clientKey = { ms, txt: ranStr() };
		setCookie(ctx, 'clientKey', JSON.stringify(clientKey));
	}
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	if (!sessionKey) {
		sessionKey = { ms, txt: ranStr() };
		setCookie(ctx, 'sessionKey', JSON.stringify(sessionKey));
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
			in_ms: ms,
			code: pc.promotionToOwnerIdAtAccountId,
			num: 0,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			in_ms: ms,
			code: pc.canReactBinIdAtAccountId,
			num: 1,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			in_ms: ms,
			code: pc.canPostBinIdAtAccountId,
			num: 1,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.pwHashTxtMsAtAccountId,
			num: 0,
			txt: await argon2.hash(input.password),
		},
		{
			...id0,
			at_ms: ms,
			ms,
			code: pc.clientKeyTxtMsAtAccountId,
			num: 0,
			txt: clientKey.txt,
		},
		{
			...id0,
			at_ms: ms,
			ms: ms,
			code: pc.sessionKeyTxtMsAtAccountId,
			num: 0,
			txt: sessionKey.txt,
		},
	];
	await tdb.insert(pTable).values(partsToInsert);
	return { account };
};
