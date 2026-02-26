import type { Database } from '$lib/local-db';
import { and, or, sql, SQL } from 'drizzle-orm';
import { roleCodes, type Invite, type Membership, type Space } from '.';
import {
	assert1Row,
	channelPartsByCode,
	getGranularNumProp,
	getGranularNumTxtProp,
	type GranularNumProp,
	type PartSelect,
	type WhoWhereObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let membersPerLoad = 88;

export let _getSpaceDots = async (
	db: Database,
	input: WhoWhereObj & {
		msAfter?: number;
		roleCode?: null | GranularNumProp;
	},
) => {
	let space: undefined | Space;
	let spaceAndInviteRowFilters: undefined | SQL<unknown>;
	let invites: undefined | Invite[];
	if (input.msAfter === undefined) {
		spaceAndInviteRowFilters = or(
			and(
				pf.noAtId,
				pf.ms.gt0,
				pf.in_ms.eq(input.spaceMs),
				or(
					pf.code.eq(pc.spaceIsPublicBinId), //
					pf.code.eq(pc.newMemberPermissionCodeId),
				),
				pf.txt.isNull,
			),
			and(
				pf.noAtId,
				pf.ms.gt0,
				pf.in_ms.eq(input.spaceMs),
				or(
					pf.code.eq(pc.spaceNameTxtIdAndMemberCountNum),
					pf.code.eq(pc.spaceDescriptionTxtId),
					pf.code.eq(pc.spacePinnedQueryTxtId),
				),
				pf.txt.isNotNull,
			),
			input.roleCode?.num === roleCodes.mod || input.roleCode?.num === roleCodes.owner
				? and(
						pf.ms.gt0,
						input.roleCode?.num === roleCodes.mod //
							? pf.by_ms.eq(input.callerMs)
							: undefined,
						pf.in_ms.eq(input.spaceMs),
						pf.code.eq(pc.inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug),
					)
				: undefined,
		);
	}

	let acceptMsByMsAtInviteIdRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.at_in_ms.eq(input.spaceMs),
				pf.ms.lte(input.msAfter || Number.MAX_SAFE_INTEGER),
				pf.in_ms.eq0,
				pf.code.eq(pc.acceptMsByMsAtInviteId),
				pf.num.eq0,
				pf.txt.isNull,
			),
		)
		.orderBy(
			...(input.msAfter === undefined
				? [sql`CASE WHEN ${pTable.by_ms} = ${input.callerMs} THEN 0 ELSE 1 END`]
				: []),
			pf.ms.desc,
		)
		.limit(membersPerLoad);

	// TODO: sort all owners and mods to the top

	let {
		[pc.spaceIsPublicBinId]: spaceIsPublicBinIdRows = [],
		[pc.spaceNameTxtIdAndMemberCountNum]: spaceNameTxtIdAndMemberCountNumRows = [],
		[pc.spaceDescriptionTxtId]: spaceDescriptionTxtIdRows = [],
		[pc.spacePinnedQueryTxtId]: spacePinnedQueryTxtIdRows = [],
		[pc.newMemberPermissionCodeId]: newMemberPermissionCodeIdRows = [],
		// prettier-ignore
		[pc.inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug]: inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlugRows = [],
		[pc.permissionCodeNumIdAtAccountId]: permissionNumIdAtAccountIdRows = [],
		[pc.roleCodeNumIdAtAccountId]: roleCodeNumIdAtAccountIdRows = [],
		[pc.accountNameTxtMsByMs]: nameTxtMsAtAccountIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					spaceAndInviteRowFilters,
					and(
						or(...acceptMsByMsAtInviteIdRows.map((r) => pf.atId({ at_ms: r.at_by_ms }))),
						pf.code.eq(pc.accountNameTxtMsByMs),
					),
					and(
						or(...acceptMsByMsAtInviteIdRows.map((r) => pf.atId({ at_ms: r.by_ms }))),
						or(
							and(
								pf.in_ms.eq(input.spaceMs),
								or(
									pf.code.eq(pc.permissionCodeNumIdAtAccountId),
									pf.code.eq(pc.roleCodeNumIdAtAccountId),
								),
							),
							and(
								pf.by_ms.eq0,
								pf.in_ms.eq0, //
								pf.code.eq(pc.accountNameTxtMsByMs),
							),
						),
					),
				),
			),
	);

	if (spaceAndInviteRowFilters) {
		let spaceIsPublicBinIdRow = assert1Row(spaceIsPublicBinIdRows);
		let spaceNameTxtIdAndMemberCountNumRow = assert1Row(spaceNameTxtIdAndMemberCountNumRows);
		let spaceDescriptionTxtIdRow = assert1Row(spaceDescriptionTxtIdRows);
		let spacePinnedQueryTxtIdRow = assert1Row(spacePinnedQueryTxtIdRows);
		let newMemberPermissionCodeIdRow = assert1Row(newMemberPermissionCodeIdRows);
		space = {
			ms: input.spaceMs,
			memberCount: spaceNameTxtIdAndMemberCountNumRow.num,
			isPublic: getGranularNumProp(spaceIsPublicBinIdRow),
			name: getGranularNumTxtProp(spaceNameTxtIdAndMemberCountNumRow),
			description: getGranularNumTxtProp(spaceDescriptionTxtIdRow),
			pinnedQuery: getGranularNumTxtProp(spacePinnedQueryTxtIdRow),
			newMemberPermissionCode: getGranularNumProp(newMemberPermissionCodeIdRow),
		};

		invites = inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlugRows.map((row) => ({
			ms: row.ms,
			by_ms: row.by_ms,
			in_ms: row.in_ms,
			expiryMs: row.at_by_ms,
			slug: row.txt!,
		}));

		let inviteLinkAuthorNameRowFilter =
			input.roleCode?.num === roleCodes.owner
				? and(
						pf.ms.gt0,
						// pf.in_ms.eq(input.spaceMs),
						pf.code.eq(pc.accountNameTxtMsByMs),
					)
				: undefined;
	}

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < nameTxtMsAtAccountIdRows.length; i++) {
		let { txt, at_ms } = nameTxtMsAtAccountIdRows[i];
		msToAccountNameTxtMap[at_ms] = txt!;
	}
	let mapByAtMs = (rows: PartSelect[]) => {
		let map: Record<number, PartSelect> = {};
		for (let row of rows) map[row.at_ms] = row;
		return map;
	};
	let accountMsToPermissionNumIdMap = mapByAtMs(permissionNumIdAtAccountIdRows);
	let accountMsToSpaceRoleNumIdMap = mapByAtMs(roleCodeNumIdAtAccountIdRows);

	let memberships: Membership[] = acceptMsByMsAtInviteIdRows.map((acceptMsByMsAtInviteIdRow) => {
		let accountMs = acceptMsByMsAtInviteIdRow.by_ms;
		return {
			invite: {
				by_ms: acceptMsByMsAtInviteIdRow.at_by_ms,
				in_ms: acceptMsByMsAtInviteIdRow.at_in_ms,
			},
			accept: {
				ms: acceptMsByMsAtInviteIdRow.ms,
				by_ms: accountMs,
			},
			permission: {
				num: accountMsToPermissionNumIdMap[accountMs].num,
				ms: accountMsToPermissionNumIdMap[accountMs].ms,
				by_ms: accountMsToPermissionNumIdMap[accountMs].by_ms,
			},
			role: {
				num: accountMsToSpaceRoleNumIdMap[accountMs].num,
				ms: accountMsToSpaceRoleNumIdMap[accountMs].ms,
				by_ms: accountMsToSpaceRoleNumIdMap[accountMs].by_ms,
			},
		};
	});

	let settingIdRows = [...roleCodeNumIdAtAccountIdRows, ...permissionNumIdAtAccountIdRows];
	let missingNameAccountMss: number[] = [];
	for (let i = 0; i < settingIdRows.length; i++) {
		let settingIdRow = settingIdRows[i];
		if (settingIdRow.by_ms && !msToAccountNameTxtMap[settingIdRow.by_ms]) {
			missingNameAccountMss.push(settingIdRow.by_ms);
		}
	}
	if (missingNameAccountMss.length) {
		let nameTxtMsAtAccountIdRows2 = await db
			.select()
			.from(pTable)
			.where(
				and(
					or(...missingNameAccountMss.map((ms) => pf.atId({ at_ms: ms }))),
					pf.by_ms.eq0,
					pf.in_ms.eq0,
					pf.code.eq(pc.accountNameTxtMsByMs),
				),
			);
		for (let i = 0; i < nameTxtMsAtAccountIdRows2.length; i++) {
			let { txt, at_ms } = nameTxtMsAtAccountIdRows2[i];
			msToAccountNameTxtMap[at_ms] = txt!;
		}
	}

	return {
		space,
		memberships,
		msToAccountNameTxtMap,
	};
};
