import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { accentCodes, permissionCodes, roleCodes } from '.';
import { type PartInsert, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { type IdObj } from '../parts/partIds';

export let makeNewSpaceRows = (a: {
	spaceMs: number;
	callerMs: number;
	spaceIsPublicBin?: number;
	spaceNameTxt?: string;
	spaceDescriptionTxt?: string;
	spacePinnedQueryTxt?: string;
	newMemberPermissionCodeNum?: number;
}) => {
	let essentialRows: PartInsert[] = [
		{
			code: pc._spaceDescription_imb_memberCount,
			txt: a.spaceDescriptionTxt ?? '',
			p1: a.spaceMs,
			p2: a.spaceMs,
			p3: a.spaceMs === 1 || a.spaceMs === a.callerMs ? 0 : a.callerMs,
			p4: 1,
		},
		{
			code: pc._spacePinnedQuery_imb,
			txt: a.spacePinnedQueryTxt ?? '',
			p1: a.spaceMs,
			p2: a.spaceMs,
			p3: a.spacePinnedQueryTxt ? a.callerMs : 0,
		},
	];
	if (a.spaceMs !== a.callerMs && a.spaceMs !== 1) {
		if (a.spaceIsPublicBin === undefined) throw new Error(`Missing spaceIsPublicBin`);
		if (a.spaceNameTxt === undefined) throw new Error(`Missing spaceNameTxt`);
		if (a.newMemberPermissionCodeNum === undefined)
			throw new Error(`Missing newMemberPermissionCodeNum`);
	}
	let supplementSpaceRows: PartInsert[] =
		a.spaceMs === a.callerMs
			? []
			: a.spaceMs === 1
				? [
						{
							code: pc.imb_newMemberPermissionCode,
							p1: a.spaceMs,
							p2: a.spaceMs,
							p3: 0,
							p4: permissionCodes.reactOnly,
						},
					]
				: [
						{
							code: pc.imb_spaceIsPublic,
							p1: a.spaceMs,
							p2: a.spaceMs,
							p3: a.callerMs,
							p4: a.spaceIsPublicBin,
						},
						{
							code: pc._spaceName_imb,
							txt: a.spaceNameTxt,
							p1: a.spaceMs,
							p2: a.spaceMs,
							p3: a.callerMs,
						},
						{
							code: pc.imb_newMemberPermissionCode,
							p1: a.spaceMs,
							p2: a.spaceMs,
							p3: a.callerMs,
							p4: a.newMemberPermissionCodeNum,
						},
					];
	return [...essentialRows, ...supplementSpaceRows];
};

export let makeRowsForJoiningSpace = (a: {
	now: number;
	callerMs: number;
	inviteIdObj: IdObj;
	permissionCodeNum: number;
	roleCodeNum: number;
}) =>
	[
		{
			code: pc.acceptIbm_inviteMb,
			p1: a.inviteIdObj.in_ms,
			p2: a.callerMs,
			p3: a.now,
			p4: a.inviteIdObj.ms,
			p5: a.inviteIdObj.by_ms,
		},
		{
			code: pc.i_accountMs_roleCode_mb,
			p1: a.inviteIdObj.in_ms,
			p2: a.callerMs,
			p3: a.roleCodeNum,
			p4: a.now,
			p5: 0,
		},
		{
			code: pc.i_accountMs_permCode_mb,
			p1: a.inviteIdObj.in_ms,
			p2: a.callerMs,
			p3: a.permissionCodeNum,
			p4: a.now,
			p5: 0,
		},
		{
			code: pc._flair_i_accountMs_mb,
			txt: '',
			p1: a.inviteIdObj.in_ms,
			p2: a.callerMs,
			p3: a.now,
			p4: 0,
		},
		{
			code: pc.i_accountMs_accentCode_lastViewMs_sidePriority,
			p1: a.inviteIdObj.in_ms,
			p2: a.callerMs,
			p3: accentCodes.none,
			p4: a.now,
			p5: a.inviteIdObj.in_ms === 1 ? 0 : a.now,
		},
	] satisfies PartInsert[];

export let _createSpace = async (
	input: WhoObj & {
		spaceNameTxt: string;
		spaceDescriptionTxt: string;
		spacePinnedQueryTxt: string;
		spaceIsPublicBin: number;
		newMemberPermissionCodeNum: number;
	},
) => {
	let now = Date.now();
	await tdb
		.insert(pTable)
		.values([
			...makeNewSpaceRows({ ...input, spaceMs: now }),
			...makeRowsForJoiningSpace({
				now: now,
				callerMs: input.callerMs,
				inviteIdObj: { ms: now, by_ms: 0, in_ms: now },
				roleCodeNum: roleCodes.admin,
				permissionCodeNum: permissionCodes.reactAndPost,
			}),
			{
				code: pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs,
				txt: '',
				p1: now,
				p2: 0,
				p3: now,
				p4: 0,
				p5: 1,
				p6: 1,
				p7: 0,
			},
		])
		.returning();
	return { ms: now };
};
