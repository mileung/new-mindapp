import { hasDefinedKeysBesidesMs } from '$lib/js';
import type { Database } from '$lib/local-db';
import { and, or, sql } from 'drizzle-orm';
import {
	makeMyValidInvitesFilter,
	roleCodes,
	type Invite,
	type Membership,
	type SpaceDotsUpdate,
} from '.';
import {
	assertLt2Rows,
	channelPartsByCode,
	getGranularNumProp,
	getGranularTxtProp,
	type GranularNumProp,
	type GranularTxtProp,
	type PartSelect,
	type WhoWhereObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let membersPerLoad = 8;

export let _getSpaceDots = async (
	db: Database,
	input: WhoWhereObj & {
		roleCode?: null | GranularNumProp;
		msBefore?: number;
		lastMemberListRoleCodeNum?: number;
		lastAcceptByMssWithSameRoleMs?: number[];
		memberCount?: number;
		description?: GranularTxtProp;
		newMemberPermissionCode?: GranularNumProp;
	},
) => {
	let {
		spaceMs,
		callerMs,
		msBefore,
		roleCode,
		lastMemberListRoleCodeNum = roleCodes.owner,
		lastAcceptByMssWithSameRoleMs = [],
	} = input;
	let spaceUpdate: undefined | SpaceDotsUpdate;
	let invites: undefined | Invite[];

	let firstLoad = msBefore === undefined;
	let isLocal = !spaceMs;
	let isPersonal = !isLocal && callerMs === spaceMs;
	let isLocalOrPersonal = isLocal || isPersonal;

	let roleCodeNumIdAtAccountIdRows = isLocalOrPersonal
		? []
		: await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.at_ms.gt0,
						...lastAcceptByMssWithSameRoleMs.map((at_ms) => pf.at_ms.notEq(at_ms)),
						or(
							and(
								pf.num.eq(lastMemberListRoleCodeNum),
								pf.ms.lt(msBefore || Number.MAX_SAFE_INTEGER),
							),
							pf.num.lt(lastMemberListRoleCodeNum),
						),
						pf.in_ms.eq(spaceMs),
						pf.code.eq(pc.roleCodeNumIdAtAccountId),
						pf.txt.isNull,
					),
				)
				.orderBy(
					...(firstLoad ? [sql`CASE WHEN ${pTable.at_ms} = ${callerMs} THEN 0 ELSE 1 END`] : []),
					pf.num.desc,
					pf.ms.desc,
				)
				.limit(membersPerLoad);

	// TODO: sort all owners and mods to the top

	let {
		[pc.spaceDescriptionTxtIdAndMemberCountNum]: spaceDescriptionTxtIdAndMemberCountNumRows = [],
		[pc.newMemberPermissionCodeNumId]: newMemberPermissionCodeNumIdRows = [],
		// prettier-ignore
		[pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt]: inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxtRows = [],
		[pc.permissionCodeNumIdAtAccountId]: permissionCodeNumIdAtAccountIdRows = [],
		[pc.acceptMsByMsAtInviteId]: acceptMsByMsAtInviteIdRows = [],
		[pc.flairTxtIdAtAccountId]: flairTxtIdAtAccountIdRows = [],
		[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					firstLoad
						? or(
								...(isLocalOrPersonal
									? []
									: [
											roleCode?.num === roleCodes.mod || roleCode?.num === roleCodes.owner
												? makeMyValidInvitesFilter(callerMs, spaceMs)
												: undefined,
											and(
												pf.noAtId,
												pf.ms.gt0,
												pf.in_ms.eq(spaceMs),
												input.newMemberPermissionCode &&
													pf.notGranularNum(input.newMemberPermissionCode),
												pf.code.eq(pc.newMemberPermissionCodeNumId),
												pf.txt.isNull,
											),
										]),
								and(
									pf.noAtId,
									pf.ms.gt0,
									pf.in_ms.eq(spaceMs),
									pf.code.eq(pc.spaceDescriptionTxtIdAndMemberCountNum),
									or(
										...(input.memberCount === undefined || input.description === undefined
											? []
											: [
													pf.num.notEq(input.memberCount),
													pf.txt.notEq(input.description.txt),
													pf.ms.notEq(input.description.ms || 0),
												]),
									),
									pf.txt.isNotNull,
								),
							)
						: undefined,
					...(roleCodeNumIdAtAccountIdRows.length
						? [
								and(
									pf.noAtId,
									pf.ms.gt0,
									or(
										...[
											...new Set(roleCodeNumIdAtAccountIdRows.flatMap((r) => [r.by_ms, r.at_ms])),
										].map((accountMs) => pf.by_ms.eq(accountMs)),
									),
									pf.in_ms.eq0,
									pf.code.eq(pc.accountNameTxtMsByMs),
								),
								and(
									pf.at_in_ms.eq(spaceMs),
									pf.ms.gt0,
									or(...roleCodeNumIdAtAccountIdRows.map((r) => pf.by_ms.eq(r.at_ms))),
									pf.in_ms.eq0,
									pf.code.eq(pc.acceptMsByMsAtInviteId),
								),
								and(
									or(...roleCodeNumIdAtAccountIdRows.map((r) => pf.atId({ at_ms: r.at_ms }))),
									pf.ms.gt0,
									pf.in_ms.eq(spaceMs),
									or(
										pf.code.eq(pc.permissionCodeNumIdAtAccountId),
										pf.code.eq(pc.flairTxtIdAtAccountId),
									),
								),
							]
						: []),
				),
			),
	);

	if (firstLoad) {
		spaceUpdate = { ms: spaceMs };
		let spaceDescriptionTxtIdAndMemberCountNumRow = assertLt2Rows(
			spaceDescriptionTxtIdAndMemberCountNumRows,
		);
		if (spaceDescriptionTxtIdAndMemberCountNumRow) {
			spaceUpdate.memberCount = spaceDescriptionTxtIdAndMemberCountNumRow.num;
			spaceUpdate.description = getGranularTxtProp(spaceDescriptionTxtIdAndMemberCountNumRow);
		}
		let newMemberPermissionCodeNumIdRow = assertLt2Rows(newMemberPermissionCodeNumIdRows);
		if (newMemberPermissionCodeNumIdRow) {
			spaceUpdate.newMemberPermissionCode = getGranularNumProp(newMemberPermissionCodeNumIdRow);
		}

		if (!hasDefinedKeysBesidesMs(spaceUpdate)) spaceUpdate = undefined;

		invites = inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxtRows.map(
			(row) => ({
				ms: row.ms,
				by_ms: row.by_ms,
				in_ms: row.in_ms,
				expiryMs: row.at_ms,
				maxUses: row.at_in_ms,
				useCount: row.at_by_ms,
				slugEnd: row.txt!,
			}),
		);
	}

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < accountNameTxtMsByMsRows.length; i++) {
		let { txt, by_ms } = accountNameTxtMsByMsRows[i];
		msToAccountNameTxtMap[by_ms] = txt!;
	}
	let accountMsToRoleFlairMap: Record<
		number,
		{
			role: GranularNumProp;
			flair: GranularTxtProp;
		}
	> = {};
	for (let i = 0; i < roleCodeNumIdAtAccountIdRows.length; i++) {
		let { ms, num, by_ms, at_ms } = roleCodeNumIdAtAccountIdRows[i];
		accountMsToRoleFlairMap[at_ms] = {
			role: { num, ms, by_ms },
			flair: { txt: '' },
		};
	}
	for (let i = 0; i < flairTxtIdAtAccountIdRows.length; i++) {
		let { ms, txt, by_ms, at_ms } = flairTxtIdAtAccountIdRows[i];
		accountMsToRoleFlairMap[at_ms].flair = { txt: txt!, ms, by_ms };
	}

	let accountMsToPermissionNumIdMap: Record<number, PartSelect> = {};
	for (let row of permissionCodeNumIdAtAccountIdRows)
		accountMsToPermissionNumIdMap[row.at_ms] = row;

	let acceptMsByMsAtInviteIdMap: Record<number, PartSelect> = {};
	for (let row of acceptMsByMsAtInviteIdRows) acceptMsByMsAtInviteIdMap[row.by_ms] = row;

	let memberships: Membership[] = roleCodeNumIdAtAccountIdRows.map(
		(roleCodeNumIdAtAccountIdRow) => {
			let accountMs = roleCodeNumIdAtAccountIdRow.at_ms;
			let acceptMsByMsAtInviteIdRow = acceptMsByMsAtInviteIdMap[accountMs];
			let accountMsToPermissionNumIdRow = accountMsToPermissionNumIdMap[accountMs];
			return {
				invite: {
					by_ms: acceptMsByMsAtInviteIdRow.at_by_ms,
					in_ms: spaceMs,
				},
				accept: {
					ms: acceptMsByMsAtInviteIdRow.ms,
					by_ms: accountMs,
				},
				permission: {
					num: accountMsToPermissionNumIdRow.num,
					ms: accountMsToPermissionNumIdRow.ms,
					by_ms: accountMsToPermissionNumIdRow.by_ms,
				},
				// role: {
				// 	num: roleCodeNumIdAtAccountIdRow.num,
				// 	ms: roleCodeNumIdAtAccountIdRow.ms,
				// 	by_ms: roleCodeNumIdAtAccountIdRow.by_ms,
				// },
				// flair: {
				// 	num: accountMsToPermissionNumIdRow.num,
				// 	ms: accountMsToPermissionNumIdRow.ms,
				// 	by_ms: accountMsToPermissionNumIdRow.by_ms,
				// },
			};
		},
	);

	let procuredRows = [
		...spaceDescriptionTxtIdAndMemberCountNumRows,
		...newMemberPermissionCodeNumIdRows,
		...permissionCodeNumIdAtAccountIdRows,
		...acceptMsByMsAtInviteIdRows,
		...flairTxtIdAtAccountIdRows,
	];
	let missingNameAccountMssSet: Set<number> = new Set();
	for (let i = 0; i < procuredRows.length; i++) {
		let procuredRow = procuredRows[i];
		let procuringAccountMs =
			pc.acceptMsByMsAtInviteId === procuredRow.code ? procuredRow.at_by_ms : procuredRow.by_ms;
		if (procuringAccountMs && !msToAccountNameTxtMap[procuringAccountMs]) {
			missingNameAccountMssSet.add(procuringAccountMs);
		}
	}
	let missingNameAccountMss = [...missingNameAccountMssSet];
	if (missingNameAccountMss.length) {
		let _accountNameTxtMsByMsRows = await db
			.select()
			.from(pTable)
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					or(...missingNameAccountMss.map((ms) => pf.by_ms.eq(ms))),
					pf.in_ms.eq0,
					pf.code.eq(pc.accountNameTxtMsByMs),
				),
			);
		for (let i = 0; i < _accountNameTxtMsByMsRows.length; i++) {
			let { txt, by_ms } = _accountNameTxtMsByMsRows[i];
			msToAccountNameTxtMap[by_ms] = txt!;
		}
	}

	return {
		spaceUpdate,
		invites: invites?.length ? invites : undefined,
		memberships,
		msToAccountNameTxtMap,
		accountMsToRoleFlairMap,
	};
};
