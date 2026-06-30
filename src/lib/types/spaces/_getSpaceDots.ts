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
		msLte?: number;
		excludeMemberMss?: number[];
		lastMemberListRoleCodeNum?: number;
	},
	ownerCalled: boolean,
) => {
	let {
		callerRoleCodeNum,
		spaceMs,
		callerMs,
		getCallerMembership,
		msLte,
		excludeMemberMss = [],
		lastMemberListRoleCodeNum = roleCodes.admin,
	} = input;
	let spaceUpdate: undefined | SpaceDotsUpdate;
	let invites: undefined | Invite[];

	let firstLoad = msLte === undefined;
	let isLocal = !spaceMs;
	let isPersonal = !isLocal && callerMs === spaceMs;
	let isLocalOrPersonal = isLocal || isPersonal;

	let i_accountMs_roleCode_mbRows = isLocalOrPersonal
		? []
		: await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.i_accountMs_roleCode_mb),
						pf.p1.eq(spaceMs),
						...excludeMemberMss.map((memberMs) => pf.p2.notEq(memberMs)),
						or(
							getCallerMembership ? pf.p2.eq(callerMs) : undefined,
							pf.p3.lt(lastMemberListRoleCodeNum),
							and(pf.p3.eq(lastMemberListRoleCodeNum), pf.p4.lte(msLte || Number.MAX_SAFE_INTEGER)),
						),
					),
				)
				.orderBy(
					...(getCallerMembership
						? [sql`CASE WHEN ${pTable.p2} = ${callerMs} THEN 0 ELSE 1 END`]
						: []),
					pf.p3.desc,
					pf.p4.desc,
				)
				.limit(membersPerLoad);

	// TODO: sort all admins and mods to the top

	let {
		// prettier-ignore
		[pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs]: _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRows = [],
		[pc._spaceDescription_imb_memberCount]: _spaceDescription_imb_memberCountRows = [],
		[pc.imb_newMemberPermissionCode]: imb_newMemberPermissionCodeRows = [],
		[pc.i_accountMs_permCode_mb]: i_accountMs_permCode_mbRows = [],
		[pc._flair_i_accountMs_mb]: _flair_i_accountMs_mbRows = [],
		[pc.acceptBm_inviteIbm]: acceptBm_inviteIbmRows = [],
		[pc._accountName_bm]: _accountName_bmRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					getCallerMembership &&
						!isLocalOrPersonal &&
						(ownerCalled ||
							callerRoleCodeNum === roleCodes.mod ||
							callerRoleCodeNum === roleCodes.admin)
						? makeMyValidInvitesFilter(callerMs, spaceMs)
						: undefined,
					firstLoad
						? or(
								isLocalOrPersonal
									? undefined
									: and(
											pf.code.eq(pc.imb_newMemberPermissionCode),
											pf.p1.eq(spaceMs),
											input.newMemberPermissionCode &&
												or(
													pf.p2.notEq(input.newMemberPermissionCode.ms ?? 0),
													pf.p4.notEq(input.newMemberPermissionCode.num),
												),
										),
								and(
									pf.code.eq(pc._spaceDescription_imb_memberCount),
									pf.p1.eq(spaceMs),
									or(
										...(input.memberCount === undefined || input.description === undefined
											? []
											: [
													pf.txt.notEq(input.description.txt),
													pf.p2.notEq(input.description.ms ?? 0),
													pf.p4.notEq(input.memberCount),
												]),
									),
								),
							)
						: undefined,
					...(i_accountMs_roleCode_mbRows.length
						? [
								and(
									pf.code.eq(pc._accountName_bm),
									or(
										...[...new Set(i_accountMs_roleCode_mbRows.flatMap((r) => [r.p2!, r.p5!]))].map(
											(accountMs) => pf.p1.eq(accountMs),
										),
									),
								),
								and(
									pf.code.eq(pc.acceptBm_inviteIbm),
									pf.p3.eq(spaceMs),
									or(...i_accountMs_roleCode_mbRows.map((r) => pf.p1.eq(r.p2!))),
								),
								and(
									or(
										pf.code.eq(pc.i_accountMs_permCode_mb),
										pf.code.eq(pc._flair_i_accountMs_mb), //
									),
									pf.p1.eq(spaceMs),
									or(...i_accountMs_roleCode_mbRows.map((r) => pf.p2.eq(r.p2!))),
								),
							]
						: []),
				),
			),
	);

	if (firstLoad) {
		spaceUpdate = { ms: spaceMs };
		let _spaceDescription_imb_memberCountRow = assertLt2Rows(_spaceDescription_imb_memberCountRows);
		if (_spaceDescription_imb_memberCountRow) {
			spaceUpdate.memberCount = _spaceDescription_imb_memberCountRow.p4!;
			spaceUpdate.description = {
				ms: _spaceDescription_imb_memberCountRow.p2!,
				by_ms: _spaceDescription_imb_memberCountRow.p3!,
				txt: _spaceDescription_imb_memberCountRow.txt!,
			};
		}
		let imb_newMemberPermissionCodeRow = assertLt2Rows(imb_newMemberPermissionCodeRows);
		if (imb_newMemberPermissionCodeRow) {
			spaceUpdate.newMemberPermissionCode = {
				ms: imb_newMemberPermissionCodeRow.p2!,
				by_ms: imb_newMemberPermissionCodeRow.p3!,
				num: imb_newMemberPermissionCodeRow.p4!,
			};
		}

		if (!hasDefinedKeysBesidesMs(spaceUpdate)) spaceUpdate = undefined;

		invites = _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRows.map((row) => ({
			in_ms: row.p1!,
			by_ms: row.p2!,
			ms: row.p3!,
			expiryMs: row.p4!,
			useCount: row.p5!,
			maxUses: row.p6!,
			slugEnd: row.txt!,
		}));
	}

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < _accountName_bmRows.length; i++) {
		let { txt, p1 } = _accountName_bmRows[i];
		msToAccountNameTxtMap[p1!] = txt!;
	}
	let accountMsToMembershipMap: Record<number, Membership> = {};
	let missingNameAccountMssSet: Set<number> = new Set();
	let checkMissingAccountMsName = (accountMs: number) => {
		if (accountMs && !msToAccountNameTxtMap[accountMs]) {
			missingNameAccountMssSet.add(accountMs);
		}
	};

	for (let i = 0; i < i_accountMs_roleCode_mbRows.length; i++) {
		let { p2, p3, p4, p5 } = i_accountMs_roleCode_mbRows[i];
		accountMsToMembershipMap[p2!] = {
			invite: { by_ms: 0 },
			accept: { ms: 0 },
			roleCode: { num: p3!!, ms: p4!, by_ms: p5! },
			permissionCode: { num: 0, ms: 0, by_ms: 0 },
			flair: { txt: '' },
		};
	}
	for (let i = 0; i < acceptBm_inviteIbmRows.length; i++) {
		let acceptBm_inviteIbmRow = acceptBm_inviteIbmRows[i];
		let { p1, p2, p4 } = acceptBm_inviteIbmRow;
		checkMissingAccountMsName(p4!);
		accountMsToMembershipMap[p1!].invite.by_ms = p4!;
		accountMsToMembershipMap[p1!].accept.ms = p2!;
	}
	for (let i = 0; i < i_accountMs_permCode_mbRows.length; i++) {
		let { p2, p3, p4, p5 } = i_accountMs_permCode_mbRows[i];
		checkMissingAccountMsName(p5!);
		accountMsToMembershipMap[p2!].permissionCode = { num: p3!, ms: p4!, by_ms: p5! };
	}
	for (let i = 0; i < _flair_i_accountMs_mbRows.length; i++) {
		let { txt, p2, p3, p4 } = _flair_i_accountMs_mbRows[i];
		checkMissingAccountMsName(p4!);
		accountMsToMembershipMap[p2!].flair = { txt: txt!, ms: p3!, by_ms: p4! };
	}

	let missingNameAccountMss = [...missingNameAccountMssSet];
	if (missingNameAccountMss.length) {
		let __accountName_bmRows = await db
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc._accountName_bm), //
					or(...missingNameAccountMss.map((ms) => pf.p1.eq(ms))),
				),
			);
		for (let i = 0; i < __accountName_bmRows.length; i++) {
			let { txt, p1 } = __accountName_bmRows[i];
			msToAccountNameTxtMap[p1!] = txt!;
		}
	}

	return {
		spaceUpdate,
		invites: invites?.length ? invites : undefined,
		msToAccountNameTxtMap: Object.keys(msToAccountNameTxtMap).length
			? msToAccountNameTxtMap
			: undefined,
		accountMsToMembershipMap: Object.keys(accountMsToMembershipMap).length
			? accountMsToMembershipMap
			: undefined,
	};
};
