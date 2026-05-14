import { dev } from '$app/environment';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
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
	type PartSelect,
	type WhoObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { id0 } from '../parts/partIds';
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
): Promise<{ redeemed?: true; checkedInvite?: CheckedInvite }> => {
	let ms = Date.now();

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
						pf.code.eq(pc.id__accountMs_roleCode),
						pf.code.eq(pc.id__accountMs_permissionCode),
						pf.code.eq(pc.inviteId__expiryMs_useCount_maxUses_revokedMs_slugEnd),
					),
					// Pretty much all other queries in this codebase are verbose and include stuff like:
					// pf.at_ms.eq0,
					// pf.at_by_ms.eq(1),
					// pf.at_in_ms.eq(1),
					// pf.ms.gt0,
					// pf.by_ms.eq0,
					// pf.in_ms.eq(1),
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
			addTestMembers = true;
			if (dev && addTestMembers) {
				for (let i = 0; i < 88; i++) {
					testMembers.push(
						...makeRowsForJoiningSpace({
							// ms: 888,
							ms: 888 + i * week,
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
					ms,
					callerMs: input.callerMs,
					inviteIdObj: { ms: 0, by_ms: 0, in_ms: 1 },
					permissionCodeNum: permissionCodes.reactAndPost,
					roleCodeNum: roleCodes.admin,
				}),
				{
					...id0,
					at_by_ms: 1,
					at_in_ms: 1,
					ms,
					in_ms: 1,
					code: pc.inviteId__expiryMs_useCount_maxUses_revokedMs_slugEnd,
					num: 0,
					txt: input.slugEnd,
				},
				{
					...id0,
					code: pc.id__signedInEmailRules,
					txt: '',
				},
			]);
			return { redeemed: true };
		}
		return { checkedInvite };
	} else if (input.inviteMs && input.slugEnd.length === 8) {
		// TODO: check for stuff in space that may count as awaiting response?

		let inviteFilter = and(
			or(pf.at_ms.eq0, pf.at_ms.gt(ms)),
			or(pf.at_in_ms.eq0, lt(pTable.at_by_ms, pTable.at_in_ms)),
			pf.ms.eq(input.inviteMs),
			pf.by_ms.gt0,
			pf.in_ms.gt0,
			pf.code.eq(pc.inviteId__expiryMs_useCount_maxUses_revokedMs_slugEnd),
			pf.num.isNull,
			pf.txt.eq(input.slugEnd),
		);
		let inviteRows = await tdb.select().from(pTable).where(inviteFilter);
		let inviteRow = assertLt2Rows(inviteRows);
		if (inviteRow) {
			if (input.useIfValid) {
				if (input.callerMs === inviteRow.by_ms) throw new Error(m.cannotUseYourOwnInvite());
				let {
					[pc.id_newMemberPermissionCode]: id_newMemberPermissionCodeRows = [],
					[pc.id__accountMs_roleCode]: id__accountMs_roleCodeRows = [],
				} = channelPartsByCode(
					await tdb
						.select()
						.from(pTable)
						.where(
							or(
								and(
									pf.noAtId,
									pf.in_ms.eq(inviteRow.in_ms),
									pf.code.eq(pc.id_newMemberPermissionCode),
									pf.num.gte0,
									pf.txt.isNull,
								),
								and(
									or(
										pf.at_ms.eq(input.callerMs), //
										pf.at_ms.eq(inviteRow.by_ms),
									),
									pf.ms.gt0,
									pf.in_ms.eq(inviteRow.in_ms),
									pf.code.eq(pc.id__accountMs_roleCode),
									pf.txt.isNull,
								),
							),
						),
				);
				let caller_id__accountMs_roleCodeRow: undefined | PartSelect;
				let inviter_id__accountMs_roleCodeRow: undefined | PartSelect;
				for (let i = 0; i < id__accountMs_roleCodeRows.length; i++) {
					let row = id__accountMs_roleCodeRows[i];
					if (row.at_ms === input.callerMs) caller_id__accountMs_roleCodeRow = row;
					if (row.at_ms === inviteRow.by_ms) inviter_id__accountMs_roleCodeRow = row;
				}
				if (caller_id__accountMs_roleCodeRow) throw new Error(m.alreadyJoinedThisSpace());
				let inviterRoleCodeNum = inviter_id__accountMs_roleCodeRow!.num;
				throwIf(inviterRoleCodeNum !== roleCodes.admin && inviterRoleCodeNum !== roleCodes.mod);

				let id_newMemberPermissionCodeRow = assert1Row(id_newMemberPermissionCodeRows);
				await tdb.insert(pTable).values(
					makeRowsForJoiningSpace({
						ms,
						inviteIdObj: inviteRow,
						callerMs: input.callerMs,
						permissionCodeNum: id_newMemberPermissionCodeRow.num!,
						roleCodeNum: roleCodes.member,
					}),
				);
				await moveSpaceMemberCountBy1(inviteRow.in_ms, true);
				await tdb
					.update(pTable)
					.set({ at_by_ms: sql`${pTable.at_by_ms} + 1` })
					.where(inviteFilter);
				return { redeemed: true };
			} else {
				let {
					// prettier-ignore
					[pc.id_memberCount_spaceDescription]: id_memberCount_spaceDescriptionRows = [],
					[pc.id__spaceName]: id__spaceNameRows = [],
					[pc.msByMs__accountName]: msByMs__accountNameRows = [],
					[pc.id__accountMs_roleCode]: inviter_id__accountMs_roleCodeRows = [],
				} = channelPartsByCode(
					await tdb
						.select()
						.from(pTable)
						.where(
							or(
								and(
									pf.noAtId,
									pf.ms.gt0,
									pf.in_ms.eq(inviteRow.in_ms),
									or(
										inviteRow.in_ms > 1 ? pf.code.eq(pc.id__spaceName) : undefined,
										pf.code.eq(pc.id_memberCount_spaceDescription),
									),
									pf.txt.isNotNull,
								),
								and(
									pf.noAtId,
									pf.by_ms.eq(inviteRow.by_ms),
									pf.code.eq(pc.msByMs__accountName),
									pf.num.isNull,
									pf.txt.isNotNull,
								),
								and(
									pf.at_ms.eq(inviteRow.by_ms),
									pf.ms.gt0,
									pf.in_ms.eq(inviteRow.in_ms),
									pf.code.eq(pc.id__accountMs_roleCode),
									pf.txt.isNull,
								),
							),
						),
				);

				let inviter_id__accountMs_roleCodeRow = assertLt2Rows(inviter_id__accountMs_roleCodeRows);
				let inviterRoleCodeNum = inviter_id__accountMs_roleCodeRow?.num;
				if (inviterRoleCodeNum !== roleCodes.admin && inviterRoleCodeNum !== roleCodes.mod)
					return {};

				let id__spaceNameRow = assertLt2Rows(id__spaceNameRows);
				let id_memberCount_spaceDescriptionRow = assert1Row(id_memberCount_spaceDescriptionRows);
				checkedInvite.partialSpace.ms = inviteRow.in_ms;
				checkedInvite.partialSpace.name.txt = id__spaceNameRow?.txt || '';
				checkedInvite.partialSpace.memberCount = id_memberCount_spaceDescriptionRow.num!;
				checkedInvite.partialSpace.description.txt = id_memberCount_spaceDescriptionRow.txt!;
				let msByMs__accountNameRow = assert1Row(msByMs__accountNameRows);
				checkedInvite.inviter.ms = msByMs__accountNameRow.by_ms;
				checkedInvite.inviter.name.txt = msByMs__accountNameRow.txt!;

				return { checkedInvite };
			}
		}
	}
	return {};
};
