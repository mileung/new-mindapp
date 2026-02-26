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
import { permissionCodes, roleCodes } from '../spaces';

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
		partCode: pc.createAccountOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount,
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
						pf.noAtId,
						pf.ms.gt0,
						pf.in_ms.eq(1),
						pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
						pf.num.gt0,
						pf.txt.isNotNull,
					),
				)
				.orderBy(pf.num.desc, pf.ms.desc)
				.limit(888)
		).map((r) => r.txt!),
	);

	let ms = Date.now();
	let myAccountRows: PartInsert[] = [
		{
			...id0,
			ms,
			by_ms: ms,
			code: pc.accountEmailTxtMsByMs,
			num: 0,
			txt: input.email,
		},
		{
			...id0,
			ms,
			by_ms: ms,
			code: pc.accountNameTxtMsByMs,
			num: 0,
			txt: input.name,
		},
		{
			...id0,
			ms,
			by_ms: ms,
			code: pc.accountBioTxtMsByMs,
			num: 0,
			txt: '',
		},
		{
			...id0,
			ms,
			by_ms: ms,
			code: pc.accountSavedTagsTxtMsByMs,
			num: 0,
			txt: JSON.stringify(top888MostUsedGlobalTags),
		},
		{
			...id0,
			ms,
			by_ms: ms,
			code: pc.accountSpaceMssTxtMsByMs,
			num: 0,
			txt: JSON.stringify([]),
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
			ms,
			in_ms: ms, // This is an account's personal space
			code: pc.spaceIsPublicBinId,
			num: 0,
		},
		{
			...id0,
			ms,
			in_ms: ms,
			code: pc.spaceNameTxtIdAndMemberCountNum,
			num: 1,
			txt: '',
		},
		{
			...id0,
			ms,
			in_ms: ms,
			code: pc.spaceDescriptionTxtId,
			num: 0,
			txt: '',
		},
		{
			...id0,
			ms,
			in_ms: ms,
			code: pc.spacePinnedQueryTxtId,
			num: 0,
			txt: '',
		},
		{
			...id0,
			ms,
			in_ms: ms,
			code: pc.newMemberPermissionCodeId,
			num: permissionCodes.viewOnly,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			in_ms: ms,
			code: pc.permissionCodeNumIdAtAccountId,
			num: permissionCodes.reactAndPost,
		},
		{
			...id0,
			at_ms: ms,
			ms,
			in_ms: ms,
			code: pc.roleCodeNumIdAtAccountId,
			num: roleCodes.owner,
		},
		{
			...id0,
			ms,
			by_ms: ms,
			code: pc.accountPwHashTxtMsByMs,
			num: 0,
			txt: await argon2.hash(input.password),
		},
		{
			...id0,
			at_ms: ms,
			ms: clientKey.ms,
			code: pc.clientKeyTxtMsAtAccountId,
			num: 0,
			txt: clientKey.txt,
		},
		{
			...id0,
			at_ms: ms,
			ms: sessionKey.ms,
			code: pc.sessionKeyTxtMsAtAccountId,
			num: 0,
			txt: sessionKey.txt,
		},
		{
			...id0,
			at_by_ms: ms,
			at_in_ms: 1,
			ms,
			in_ms: ms,
			code: pc.inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug,
			num: 1,
		},
		{
			...id0,
			at_ms: ms,
			at_in_ms: ms,
			ms,
			by_ms: ms,
			code: pc.acceptMsByMsAtInviteId,
			num: 0,
		},
	];
	await tdb.insert(pTable).values(partsToInsert);
	return { account };
};
