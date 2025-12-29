import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { type Invite } from '.';
import type { WhoObj } from '../parts';
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
					pf.at_ms.eq(1),
					pf.at_by_ms.eq0,
					pf.at_in_ms.eq0,
					pf.ms.gt0,
					pf.by_ms.eq0,
					pf.in_ms.eq0,
					pf.code.eq(pc.inviteMsByMsWithNumAsUseCountAndTxtAsSlugAtSpaceId),
					pf.num.gt0,
					pf.txt.eq('init'),
				),
			)
			.limit(1);
		if (initInviteRows.length) return {};
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
					code: pc.spaceVisibilityIdNum,
					num: 1,
				},
				{
					...id0,
					at_ms: 1,
					code: pc.newUsersCanPostIdNum,
					num: 1,
				},
				{
					...id0,
					at_in_ms: 1,
					ms,
					by_ms: input.callerMs,
					code: pc.joinMsByMsAtInviteId,
					num: 0,
				},
				{
					...id0,
					at_ms: input.callerMs,
					in_ms: 1,
					code: pc.promotionToOwnerIdAtAccountId,
					num: 0,
				},
				{
					...id0,
					at_ms: 1,
					in_ms: 1,
					code: pc.inviteMsByMsWithNumAsUseCountAndTxtAsSlugAtSpaceId,
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
			},
		};
	} else {
	}
	return {};
};
