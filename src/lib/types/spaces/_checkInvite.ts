import { dev } from '$app/environment';
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
import { id0 } from '../parts/partIds';
import { makeNewSpaceRows, makeRowsForJoiningSpace } from './_createSpace';

let CheckedInviteSchema = z.object({
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
		slug: '',
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
					// only pass once and that's when an account joins the global space for the first time.
					pf.in_ms.eq(1),
					or(
						pf.code.eq(pc.roleCodeNumIdAtAccountId),
						pf.code.eq(pc.permissionCodeNumIdAtAccountId),
						pf.code.eq(pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt),
					),

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
					roleCodeNum: roleCodes.owner,
				}),
				{
					...id0,
					at_by_ms: 1,
					at_in_ms: 1,
					ms,
					in_ms: 1,
					code: pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt,
					num: 0,
					txt: input.slugEnd,
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
			pf.code.eq(pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt),
			pf.num.eq0,
			pf.txt.eq(input.slugEnd),
		);
		let inviteRows = await tdb.select().from(pTable).where(inviteFilter);
		let inviteRow = assertLt2Rows(inviteRows);
		if (inviteRow) {
			if (input.useIfValid) {
				if (input.callerMs === inviteRow.by_ms) throw new Error(m.cannotUseYourOwnInvite());
				let newMemberPermissionCodeNumIdRow = assert1Row(
					await tdb
						.select()
						.from(pTable)
						.where(
							and(
								pf.noAtId,
								pf.in_ms.eq(inviteRow.in_ms),
								pf.code.eq(pc.newMemberPermissionCodeNumId),
								pf.num.gte0,
								pf.txt.isNull,
							),
						),
				);
				await tdb.insert(pTable).values(
					makeRowsForJoiningSpace({
						ms,
						inviteIdObj: inviteRow,
						callerMs: input.callerMs,
						permissionCodeNum: newMemberPermissionCodeNumIdRow.num,
						roleCodeNum: roleCodes.member,
					}),
				);
				await tdb
					.update(pTable)
					.set({ at_by_ms: sql`${pTable.at_by_ms} + 1` })
					.where(inviteFilter);
				await tdb
					.update(pTable)
					.set({ num: sql`${pTable.num} + 1` })
					.where(
						and(
							pf.noAtId, //
							pf.in_ms.eq(inviteRow.in_ms),
							pf.code.eq(pc.spaceDescriptionTxtIdAndMemberCountNum),
						),
					);
				// permissionCodes.reactAndPost
				return { redeemed: true };
			} else {
				let {
					// prettier-ignore
					[pc.spaceDescriptionTxtIdAndMemberCountNum]: spaceDescriptionTxtIdAndMemberCountNumRows = [],
					[pc.spaceNameTxtId]: spaceNameTxtIdRows = [],
					[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
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
										inviteRow.in_ms > 1 ? pf.code.eq(pc.spaceNameTxtId) : undefined,
										pf.code.eq(pc.spaceDescriptionTxtIdAndMemberCountNum),
									),
									pf.txt.isNotNull,
								),
								and(
									pf.noAtId,
									pf.by_ms.eq(inviteRow.by_ms),
									pf.code.eq(pc.accountNameTxtMsByMs),
									pf.num.eq0,
									pf.txt.isNotNull,
								),
							),
						),
				);

				let spaceNameTxtIdRow = assertLt2Rows(spaceNameTxtIdRows);
				let spaceDescriptionTxtIdAndMemberCountNumRow = assert1Row(
					spaceDescriptionTxtIdAndMemberCountNumRows,
				);
				checkedInvite.partialSpace.ms = inviteRow.in_ms;
				checkedInvite.partialSpace.name.txt = spaceNameTxtIdRow?.txt || '';
				checkedInvite.partialSpace.memberCount = spaceDescriptionTxtIdAndMemberCountNumRow.num;
				checkedInvite.partialSpace.description.txt = spaceDescriptionTxtIdAndMemberCountNumRow.txt!;
				let accountNameTxtMsByMsRow = assert1Row(accountNameTxtMsByMsRows);
				checkedInvite.inviter.ms = accountNameTxtMsByMsRow.by_ms;
				checkedInvite.inviter.name.txt = accountNameTxtMsByMsRow.txt!;

				return { checkedInvite };
			}
		}
	}
	return {};
};
