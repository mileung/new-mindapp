import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import type { Membership, Space } from '.';
import { assert1Row, assertLt2Rows, channelPartsByCode, type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _getSpaceInfo = async (
	input: WhoWhereObj,
): Promise<{ space: null | Space; membership: null | Membership }> => {
	let {
		[pc.spaceIsPublicBinId]: spaceIsPublicBinIdRows = [],
		[pc.spaceNameTxtIdAndMemberCountNum]: spaceNameTxtIdRows = [],
		[pc.spaceDescriptionTxtId]: spaceDescriptionTxtIdWithNumAsMemberCountRows = [],
		[pc.newMemberPermissionCodeId]: newMemberPermissionCodeIdRows = [],
		[pc.permissionCodeNumIdAtAccountId]: permissionNumIdAtAccountIdRows = [],
		[pc.roleCodeNumIdAtAccountId]: assignedRoleNumIdAtAccountIdRows = [],
		[pc.acceptMsByMsAtInviteId]: acceptMsByMsAtInviteIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(pf.noAtId, pf.in_ms.eq(input.spaceMs), pf.code.eq(pc.spaceIsPublicBinId)),
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.in_ms.eq(input.spaceMs),
						or(
							pf.code.eq(pc.spaceNameTxtIdAndMemberCountNum),
							pf.code.eq(pc.spaceDescriptionTxtId),
							pf.code.eq(pc.newMemberPermissionCodeId),
						),
					),
					and(
						pf.atId({ at_ms: input.callerMs }),
						pf.ms.gt0,
						pf.in_ms.eq(input.spaceMs),
						or(
							pf.code.eq(pc.permissionCodeNumIdAtAccountId),
							pf.code.eq(pc.roleCodeNumIdAtAccountId),
						),
					),
					and(
						pf.at_in_ms.eq(input.spaceMs),
						pf.ms.gt0,
						pf.by_ms.eq(input.callerMs),
						pf.in_ms.eq0,
						pf.code.eq(pc.acceptMsByMsAtInviteId),
					),
				),
			),
	);

	let spaceIsPublicBinIdRow = assertLt2Rows(spaceIsPublicBinIdRows);
	let acceptMsByMsAtInviteIdRow = assertLt2Rows(acceptMsByMsAtInviteIdRows);
	if (!spaceIsPublicBinIdRow || (!spaceIsPublicBinIdRow.num && !acceptMsByMsAtInviteIdRow))
		return { space: null, membership: null };

	let spaceNameTxtIdRow = assert1Row(spaceNameTxtIdRows);
	let spaceDescriptionTxtIdWithNumAsMemberCountRowsRow = assert1Row(
		spaceDescriptionTxtIdWithNumAsMemberCountRows,
	);
	let newMemberPermissionCodeIdRow = assert1Row(newMemberPermissionCodeIdRows);

	let space: Space = {
		ms: input.spaceMs,
		nameAndIsPublicNum: {
			ms: spaceNameTxtIdRow.ms,
			by_ms: spaceNameTxtIdRow.by_ms,
			num: spaceNameTxtIdRow.num,
			txt: spaceNameTxtIdRow.txt!,
		},
		descriptionAndMemberCountNum: {
			ms: spaceDescriptionTxtIdWithNumAsMemberCountRowsRow.ms,
			by_ms: spaceDescriptionTxtIdWithNumAsMemberCountRowsRow.by_ms,
			num: spaceDescriptionTxtIdWithNumAsMemberCountRowsRow.num,
			txt: spaceDescriptionTxtIdWithNumAsMemberCountRowsRow.txt!,
		},
		newMemberPermissionNum: {
			ms: newMemberPermissionCodeIdRow.ms,
			by_ms: newMemberPermissionCodeIdRow.by_ms,
			num: newMemberPermissionCodeIdRow.num,
		},
	};

	let permissionNumIdAtAccountIdRow = assert1Row(permissionNumIdAtAccountIdRows);
	let assignedRoleNumIdAtAccountIdRow = assertLt2Rows(assignedRoleNumIdAtAccountIdRows);

	let membership: null | Membership = acceptMsByMsAtInviteIdRow
		? {
				invite: {
					by_ms: acceptMsByMsAtInviteIdRow.at_by_ms,
					in_ms: acceptMsByMsAtInviteIdRow.at_in_ms,
				},
				accept: {
					ms: acceptMsByMsAtInviteIdRow.ms,
					by_ms: acceptMsByMsAtInviteIdRow.by_ms,
				},
				permissionNum: {
					by_ms: permissionNumIdAtAccountIdRow.by_ms,
					ms: permissionNumIdAtAccountIdRow.by_ms,
					num: permissionNumIdAtAccountIdRow.num,
				},
				role: assignedRoleNumIdAtAccountIdRow
					? {
							num: assignedRoleNumIdAtAccountIdRow.num,
							ms: assignedRoleNumIdAtAccountIdRow.ms,
							by_ms: assignedRoleNumIdAtAccountIdRow.by_ms,
						}
					: undefined,
			}
		: null;

	return { space, membership };
};
