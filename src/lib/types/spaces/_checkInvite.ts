import { dev } from '$app/environment';
import { throwIf } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { week } from '$lib/time';
import { pTable } from '$lib/types/parts/partsTable';
import { and, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { permissionCodes, roleCodes, SpaceSchema } from '.';
import { MyAccountSchema } from '../accounts';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartInsert,
	type WhoObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { makeNewSpaceRows, makeRowsForJoiningSpace } from './_createSpace';
import { moveSpaceMemberCountBy1 } from './db-spaces';

let CheckedInviteSchema = z.strictObject({
	ms: z.number(),
	slugEnd: z.string(),
	inviter: MyAccountSchema.pick({
		ms: true,
		name: true,
	}),
	partialSpace: SpaceSchema.pick({
		ms: true,
		memberCount: true,
		name: true,
		description: true,
	}),
});

export type CheckedInvite = z.infer<typeof CheckedInviteSchema>;

export let _checkInvite = async (
	input: WhoObj & {
		inviteMs: number;
		slugEnd: string;
		useIfValid: boolean;
	},
): Promise<{ redeemMs?: number; checkedInvite?: CheckedInvite }> => {
	let now = Date.now();
	let checkedInvite: CheckedInvite = {
		ms: 0,
		slugEnd: '',
		inviter: { ms: 0, name: { txt: '' } },
		partialSpace: {
			ms: 1,
			memberCount: 0,
			name: { txt: '' },
			description: { txt: '' },
		},
	};

	if (!input.inviteMs && input.slugEnd === 'init') {
		let initInviteRows = await tdb
			.select()
			.from(pTable)
			.where(
				and(
					// This check is so critical and consequential that I'm intentionally making it as
					// broad as possible to eliminate any chance of a false negative. This check should
					// only pass once and that's when the global space has no members
					or(
						pf.code.eq(pc._spaceDescription_imb_memberCount),
						pf.code.eq(pc._spacePinnedQuery_imb),
						pf.code.eq(pc.imb_newMemberPermissionCode),
						pf.code.eq(pc.i_accountMs_roleCode_mb),
						pf.code.eq(pc.i_accountMs_permCode_mb),
						pf.code.eq(pc._flair_i_accountMs_mb),
						pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
						pf.code.eq(pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs),
					),
					pf.p1.eq(1),

					// Pretty much all other queries in this codebase are verbose and include stuff like:
					// pf.at_ms.eq0,
					// pf.at_by_ms.eq(1),
					// pf.at_in_ms.eq(1),
					// pf.ms.gt0,
					// pf.by_ms.eq0,
					// pf.num.eq0,
					// pf.txt.eq('init'),
				),
			)
			.limit(1);
		let initInviteRow = assertLt2Rows(initInviteRows);
		if (initInviteRow) return {};
		if (input.useIfValid) {
			let testMembers: PartInsert[] = [];
			let addTestMembers = false;
			// addTestMembers = true;
			if (dev && addTestMembers) {
				for (let i = 0; i < 88; i++) {
					testMembers.push(
						...makeRowsForJoiningSpace({
							// ms: 888,
							now: 888 + i * week,
							callerMs: 1 + i,
							inviteIdObj: { ms: 0, by_ms: 0, in_ms: 1 },
							permissionCodeNum: 0,
							roleCodeNum: i % 8 === 1 ? roleCodes.mod : roleCodes.member,
						}),
					);
				}
			}

			await tdb.insert(pTable).values([
				...makeNewSpaceRows({
					spaceMs: 1,
					callerMs: input.callerMs,
				}),
				...testMembers,
				...makeRowsForJoiningSpace({
					now,
					callerMs: input.callerMs,
					inviteIdObj: { ms: 0, by_ms: 0, in_ms: 1 },
					permissionCodeNum: permissionCodes.reactAndPost,
					roleCodeNum: roleCodes.admin,
				}),
				{
					code: pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs,
					txt: input.slugEnd,
					p1: 1,
					p2: 0,
					p3: now,
					p4: 0,
					p5: 1,
					p6: 1,
					p7: 0,
				},
				{
					code: pc._signedInEmailRules_mb,
					txt: '',
				},
			]);
			return { redeemMs: now };
		}
		return { checkedInvite };
	} else if (input.inviteMs && input.slugEnd.length === 8) {
		// TODO: check for stuff in space that may count as awaiting response?
		let _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsFilter = and(
			pf.code.eq(pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs),
			pf.txt.eq(input.slugEnd),
			pf.p3.eq(input.inviteMs),
			or(
				pf.p4.gt(now),
				pf.p4.eq0, //
			),
			or(
				lt(pTable.p5, pTable.p6),
				pf.p6.eq0, //
			),
		);
		let _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRows = await tdb
			.select()
			.from(pTable)
			.where(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsFilter);
		let _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow = assertLt2Rows(
			_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRows,
		);
		if (_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow) {
			if (input.useIfValid) {
				if (input.callerMs === _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p2)
					throw new Error(m.cannotUseYourOwnInvite());
				let {
					[pc.imb_newMemberPermissionCode]: imb_newMemberPermissionCodeRows = [],
					[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows = [],
				} = channelPartsByCode(
					await tdb
						.select()
						.from(pTable)
						.where(
							or(
								and(
									pf.code.eq(pc.imb_newMemberPermissionCode),
									pf.p1.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!),
								),
								and(
									pf.code.eq(pc.i_accountMs_roleCode_mb),
									pf.p1.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!),
									or(
										pf.p2.eq(input.callerMs), //
										pf.p2.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p2!),
									),
								),
							),
						),
				);
				let i_accountMs_roleCode_mbCallerRow: undefined | PartInsert;
				let i_accountMs_roleCode_mbInviterRow: undefined | PartInsert;
				for (let i = 0; i < i_accountMs_roleCode_mbRows.length; i++) {
					let row = i_accountMs_roleCode_mbRows[i];
					if (row.p2 === input.callerMs) i_accountMs_roleCode_mbCallerRow = row;
					if (row.p2 === _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p2)
						i_accountMs_roleCode_mbInviterRow = row;
				}
				if (i_accountMs_roleCode_mbCallerRow) throw new Error(m.alreadyJoinedThisSpace());
				let inviterRoleCodeNum = i_accountMs_roleCode_mbInviterRow!.p3!;
				throwIf(inviterRoleCodeNum !== roleCodes.admin && inviterRoleCodeNum !== roleCodes.mod);
				let imb_newMemberPermissionCodeRow = assert1Row(imb_newMemberPermissionCodeRows);
				throwIf(
					!(
						await tdb
							.update(pTable)
							.set({ p5: sql`${pTable.p5} + 1` })
							.where(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsFilter)
							.returning()
					).length,
				);
				await tdb.insert(pTable).values(
					makeRowsForJoiningSpace({
						now: now,
						inviteIdObj: {
							in_ms: _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!,
							by_ms: _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p2!,
							ms: _slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p3!,
						},
						callerMs: input.callerMs,
						permissionCodeNum: imb_newMemberPermissionCodeRow.p4!,
						roleCodeNum: roleCodes.member,
					}),
				);
				await moveSpaceMemberCountBy1(
					_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!,
					true,
				);
				return { redeemMs: now };
			} else {
				let {
					// prettier-ignore
					[pc._spaceDescription_imb_memberCount]: _spaceDescription_imb_memberCountRows = [],
					[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbInviterRows = [],
					[pc._accountName_bm]: _accountName_bmRows = [],
					[pc._spaceName_imb]: _spaceName_imbRows = [],
				} = channelPartsByCode(
					await tdb
						.select()
						.from(pTable)
						.where(
							or(
								and(
									or(
										_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1! > 1
											? pf.code.eq(pc._spaceName_imb)
											: undefined,
										pf.code.eq(pc._spaceDescription_imb_memberCount),
									),
									pf.p1.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!),
								),
								and(
									pf.code.eq(pc._accountName_bm), //
									pf.p1.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p2!),
								),
								and(
									pf.code.eq(pc.i_accountMs_roleCode_mb),
									pf.p1.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!),
									pf.p2.eq(_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p2!),
								),
							),
						),
				);

				let i_accountMs_roleCode_mbInviterRow = assertLt2Rows(i_accountMs_roleCode_mbInviterRows);
				let inviterRoleCodeNum = i_accountMs_roleCode_mbInviterRow?.p3;
				if (inviterRoleCodeNum !== roleCodes.admin && inviterRoleCodeNum !== roleCodes.mod)
					return {};
				let _spaceName_imbRow = assertLt2Rows(_spaceName_imbRows);
				let _spaceDescription_imb_memberCountRow = assert1Row(
					_spaceDescription_imb_memberCountRows,
				);
				checkedInvite.partialSpace.ms =
					_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMsRow.p1!;
				checkedInvite.partialSpace.name.txt = _spaceName_imbRow?.txt ?? '';
				checkedInvite.partialSpace.memberCount = _spaceDescription_imb_memberCountRow.p4!;
				checkedInvite.partialSpace.description.txt = _spaceDescription_imb_memberCountRow.txt!;
				let _accountName_bmRow = assert1Row(_accountName_bmRows);
				checkedInvite.inviter.ms = _accountName_bmRow.p1!;
				checkedInvite.inviter.name.txt = _accountName_bmRow.txt!;
				return { checkedInvite };
			}
		}
	}
	return {};
};
