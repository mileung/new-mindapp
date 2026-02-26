import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { permissionCodes, roleCodes, type Invite } from '.';
import { assertLt2Rows, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { id0 } from '../parts/partIds';

export let _checkInvite = async (
	input: WhoObj & {
		inviteSlug: string; //
		useIfValid: boolean;
	},
): Promise<{ redeemed?: true; invite?: Invite }> => {
	let ms = Date.now();
	if (input.inviteSlug === 'init') {
		let initInviteRows = await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.by_ms.eq0,
					pf.in_ms.eq(1),
					pf.code.eq(pc.inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug),
					pf.num.gt0,
					pf.txt.eq('init'),
				),
			)
			.limit(1);
		let initInviteRow = assertLt2Rows(initInviteRows);
		if (initInviteRow) return {};
		if (input.useIfValid) {
			await tdb.insert(pTable).values([
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spaceIsPublicBinId,
					num: 1,
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spaceNameTxtIdAndMemberCountNum,
					num: 1,
					txt: '',
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spaceDescriptionTxtId,
					num: 0,
					txt: '',
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spacePinnedQueryTxtId,
					num: 0,
					txt: '',
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.newMemberPermissionCodeId,
					num: permissionCodes.reactAndPost,
				},
				{
					...id0,
					at_ms: input.callerMs,
					ms,
					in_ms: 1,
					code: pc.permissionCodeNumIdAtAccountId,
					num: permissionCodes.reactAndPost,
				},
				{
					...id0,
					at_ms: input.callerMs,
					ms,
					in_ms: 1,
					code: pc.roleCodeNumIdAtAccountId,
					num: roleCodes.owner,
				},
				{
					...id0,
					at_by_ms: ms,
					at_in_ms: 1,
					ms,
					in_ms: 1,
					code: pc.inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug,
					num: 1,
					txt: input.inviteSlug,
				},
				{
					...id0,
					at_in_ms: 1,
					ms,
					by_ms: input.callerMs,
					code: pc.acceptMsByMsAtInviteId,
					num: 0,
				},
			]);
			return { redeemed: true };
		}
		return {
			invite: {
				ms,
				by_ms: 0,
				in_ms: 1,
				slug: 'init',
				expiryMs: ms,
			},
		};
	} else {
		// space
	}
	return {};
};
