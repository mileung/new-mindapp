import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { roleCodes } from '.';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _deleteSpace = async (input: WhoWhereObj) => {
	let postImb_parentMb_rootMb_childCountRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.p1.eq(input.spaceMs),
				or(
					and(
						pf.code.eq(pc.i_accountMs_roleCode_mb),
						pf.p2.notEq(input.callerMs), //
						pf.p3.eq(roleCodes.admin),
					),
					and(
						pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
						pf.p1.eq(input.spaceMs), //
					),
				),
			),
		)
		.limit(1);
	if (postImb_parentMb_rootMb_childCountRows.length)
		throw new Error(m.aSpaceWithPostsOrMultipleAdminsCannotBeDeleted());

	await tdb.delete(pTable).where(
		or(
			and(
				pf.p1.eq(input.spaceMs),
				or(
					pf.code.eq(pc._tag_imBy8_count),
					pf.code.eq(pc._emoji_postImb_count),
					pf.code.eq(pc.tagImb_postMb_oldVersion),
					pf.code.eq(pc.tagImb_postMb_lastVersion),
					pf.code.eq(pc._emoji_reactionImb_postMb),
					pf.code.eq(pc._core_postImb_oldVersion_m),
					pf.code.eq(pc._core_postImb_lastVersion_m),

					pf.code.eq(pc._spaceName_imb),
					pf.code.eq(pc.imb_spaceIsPublic),
					pf.code.eq(pc.acceptIbm_inviteMb),
					pf.code.eq(pc._spacePinnedQuery_imb),
					pf.code.eq(pc.imb_newMemberPermissionCode),
					pf.code.eq(pc._spaceDescription_imb_memberCount),
					pf.code.eq(pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs),

					pf.code.eq(pc._flair_i_accountMs_mb),
					pf.code.eq(pc.i_accountMs_permCode_mb),
					pf.code.eq(pc.i_accountMs_roleCode_mb),
					pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
				),
			),
		),
	);
	return {};
};
