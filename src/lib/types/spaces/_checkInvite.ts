import { dev } from '$app/environment';
import { splitUntil } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { week } from '$lib/time';
import { pTable } from '$lib/types/parts/partsTable';
import { and, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { accentCodes, permissionCodes, roleCodes, SpaceSchema } from '.';
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

let CheckedInviteSchema = z.object({
	slug: z.string(),
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

export let makeEssentialJoinSpaceRows = (a: {
	ms: number;
	spaceMs: number;
	callerMs: number;
	permissionCodeNum: number;
	roleCodeNum: number;
}) => [
	{
		...id0,
		at_in_ms: a.spaceMs,
		ms: a.ms,
		by_ms: a.callerMs,
		code: pc.acceptMsByMsAtInviteId,
		num: 0,
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.spaceMs,
		code: pc.roleCodeNumIdAtAccountId,
		num: a.roleCodeNum,
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.spaceMs,
		code: pc.permissionCodeNumIdAtAccountId,
		num: a.permissionCodeNum,
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.spaceMs,
		code: pc.flairTxtIdAtAccountId,
		num: 0,
		txt: '',
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.spaceMs,
		code: pc.spacePriorityIdAccentCodeNumAtAccountId,
		num: accentCodes.none,
	},
];

export let _checkInvite = async (
	input: WhoObj & {
		inviteSlug: string; //
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

	if (input.inviteSlug === 'init') {
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
			// addTestMembers = true;
			if (dev && addTestMembers) {
				for (let i = 0; i < 88; i++) {
					testMembers.push(
						...makeEssentialJoinSpaceRows({
							// ms: 888,
							ms: 888 + i * week,
							spaceMs: 1,
							callerMs: 1 + i,
							permissionCodeNum: 0,
							roleCodeNum: roleCodes.member,
						}),
					);
				}
			}

			await tdb.insert(pTable).values([
				...testMembers,
				...makeEssentialJoinSpaceRows({
					ms,
					spaceMs: 1,
					callerMs: input.callerMs,
					permissionCodeNum: permissionCodes.reactAndPost,
					roleCodeNum: roleCodes.owner,
				}),
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spaceIsPublicBinId,
					num: 1,
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spaceDescriptionTxtIdAndMemberCountNum,
					num: 1,
					txt: '',
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.spacePinnedQueryTxtId,
					num: 0,
					txt: '',
				},
				{
					...id0,
					ms,
					in_ms: 1,
					code: pc.newMemberPermissionCodeNumId,
					num: permissionCodes.reactAndPost,
				},
				{
					...id0,
					at_by_ms: 1,
					at_in_ms: 1,
					ms,
					in_ms: 1,
					code: pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt,
					num: 0,
					txt: input.inviteSlug,
				},
			]);
			return { redeemed: true };
		}
		return { checkedInvite };
	} else {
		let [inviteMsStr, slugEnd] = splitUntil(input.inviteSlug, '_', 1);
		let inviteMs = +inviteMsStr;
		if (Number.isNaN(inviteMs)) return {};
		let inviteFilter = and(
			or(pf.at_ms.eq0, pf.at_ms.gt(ms)),
			or(pf.at_in_ms.eq0, lt(pTable.at_by_ms, pTable.at_in_ms)),
			pf.ms.eq(inviteMs),
			pf.by_ms.gt0,
			pf.in_ms.gt0,
			pf.code.eq(pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt),
			pf.num.eq0,
			pf.txt.eq(slugEnd),
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
					makeEssentialJoinSpaceRows({
						ms,
						spaceMs: 1,
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
					[pc.spaceNameTxtId]: spaceNameTxtIdRows = [],
					[pc.spaceDescriptionTxtIdAndMemberCountNum]:
						spaceDescriptionTxtIdAndMemberCountNumRows = [],
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
										pf.code.eq(pc.spaceNameTxtId),
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
				let spaceNameTxtIdRow = assert1Row(spaceNameTxtIdRows);
				let spaceDescriptionTxtIdAndMemberCountNumRow = assert1Row(
					spaceDescriptionTxtIdAndMemberCountNumRows,
				);
				checkedInvite.partialSpace.ms = spaceNameTxtIdRow.in_ms;
				checkedInvite.partialSpace.name.txt = spaceNameTxtIdRow.txt!;
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
