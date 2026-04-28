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
	type WhoWhereObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let membersPerLoad = 8;

export let _getSpaceDots = async (
	db: Database,
	input: WhoWhereObj & {
		callerRoleCodeNum?: number;
		memberCount?: number;
		description?: GranularTxtProp;
		newMemberPermissionCode?: GranularNumProp;
		getCallerMembership?: boolean;
		msBefore?: number;
		excludeMemberMss?: number[];
		lastMemberListRoleCodeNum?: number;
	},
) => {
	let {
		callerRoleCodeNum,
		spaceMs,
		callerMs,
		getCallerMembership,
		msBefore,
		excludeMemberMss = [],
		lastMemberListRoleCodeNum = roleCodes.admin,
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
						...excludeMemberMss.map((at_ms) => pf.at_ms.notEq(at_ms)),
						or(
							getCallerMembership ? pf.at_ms.eq(callerMs) : undefined,
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
					...(getCallerMembership
						? [sql`CASE WHEN ${pTable.at_ms} = ${callerMs} THEN 0 ELSE 1 END`]
						: []),
					pf.num.desc,
					pf.ms.desc,
				)
				.limit(membersPerLoad);

	// TODO: sort all admins and mods to the top

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
					getCallerMembership &&
						!isLocalOrPersonal &&
						(callerRoleCodeNum === roleCodes.mod || callerRoleCodeNum === roleCodes.admin)
						? makeMyValidInvitesFilter(callerMs, spaceMs)
						: undefined,
					firstLoad
						? or(
								isLocalOrPersonal
									? undefined
									: and(
											pf.noAtId,
											pf.ms.gt0,
											pf.in_ms.eq(spaceMs),
											input.newMemberPermissionCode &&
												pf.notGranularNum(input.newMemberPermissionCode),
											pf.code.eq(pc.newMemberPermissionCodeNumId),
											pf.txt.isNull,
										),
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
										and(
											pf.code.eq(pc.permissionCodeNumIdAtAccountId),
											pf.num.gte0, //
											pf.txt.isNull,
										),
										and(
											pf.code.eq(pc.flairTxtIdAtAccountId),
											pf.num.eq0, //
											pf.txt.notEq(''),
										),
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
	let accountMsToMembershipMap: Record<number, Membership> = {};
	let missingNameAccountMssSet: Set<number> = new Set();
	let checkMissingAccountMsName = (accountMs: number) => {
		if (accountMs && !msToAccountNameTxtMap[accountMs]) {
			missingNameAccountMssSet.add(accountMs);
		}
	};

	for (let i = 0; i < roleCodeNumIdAtAccountIdRows.length; i++) {
		let { ms, num, by_ms, at_ms } = roleCodeNumIdAtAccountIdRows[i];
		accountMsToMembershipMap[at_ms] = {
			invite: { by_ms: 0 },
			accept: { ms: 0 },
			roleCode: { num, ms, by_ms },
			permissionCode: { num: 0, ms: 0, by_ms: 0 },
			flair: { txt: '' },
		};
	}
	for (let i = 0; i < acceptMsByMsAtInviteIdRows.length; i++) {
		let acceptMsByMsAtInviteIdRow = acceptMsByMsAtInviteIdRows[i];
		let { ms, by_ms, at_by_ms } = acceptMsByMsAtInviteIdRow;
		checkMissingAccountMsName(at_by_ms);
		accountMsToMembershipMap[by_ms].invite.by_ms = at_by_ms;
		accountMsToMembershipMap[by_ms].accept.ms = ms;
	}
	for (let i = 0; i < permissionCodeNumIdAtAccountIdRows.length; i++) {
		let { num, ms, by_ms, at_ms } = permissionCodeNumIdAtAccountIdRows[i];
		checkMissingAccountMsName(by_ms);
		accountMsToMembershipMap[at_ms].permissionCode = { num, ms, by_ms };
	}
	for (let i = 0; i < flairTxtIdAtAccountIdRows.length; i++) {
		let { txt, ms, by_ms, at_ms } = flairTxtIdAtAccountIdRows[i];
		checkMissingAccountMsName(by_ms);
		accountMsToMembershipMap[at_ms].flair = { txt: txt!, ms, by_ms };
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
		msToAccountNameTxtMap,
		accountMsToMembershipMap,
	};
};
