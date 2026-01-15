import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { defaultSpaceProps, type Invite } from '.';
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
					pf.noParent,
					pf.ms.gt0,
					pf.by_ms.eq0,
					pf.in_ms.eq(1),
					pf.code.eq(pc.inviteIdWithNumAsUseCountAndTxtAsSlug),
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
					ms: 1,
					code: pc.spaceId,
					num: 0,
				},
				{
					...id0,
					at_ms: 1,
					code: pc.spaceVisibilityBinId,
					num: 1,
				},
				{
					...id0,
					at_ms: 1,
					code: pc.newUsersCanPostBinId,
					num: 1,
				},
				{
					...id0,
					at_in_ms: 1,
					ms,
					by_ms: input.callerMs,
					code: pc.acceptMsByMsAtInviteId,
					num: 0,
				},
				{
					...id0,
					at_ms: input.callerMs,
					ms,
					in_ms: 1,
					code: pc.promotionToOwnerIdAtAccountId,
					num: 0,
				},
				{
					...id0,
					at_ms: input.callerMs,
					ms,
					in_ms: 1,
					code: pc.canPostBinIdAtAccountId,
					num: 1,
				},
				{
					...id0,
					at_ms: input.callerMs,
					ms,
					in_ms: 1,
					code: pc.canReactBinIdAtAccountId,
					num: 1,
				},
				{
					...id0,
					in_ms: 1,
					code: pc.inviteIdWithNumAsUseCountAndTxtAsSlug,
					num: 1,
					txt: input.inviteSlug,
				},
			]);
			return { redeemed: true };
		}
		return {
			invite: {
				ms: 0,
				by_ms: 0,
				in_ms: 1,
				slug: 'init',
				byNameTxt: '',
				space: {
					...defaultSpaceProps,
					ms: 1, //
					isPublic: { ms: 0, by_ms: 0, num: 1 },
				},
			},
		};
	} else {
		// space
	}
	return {};
};
