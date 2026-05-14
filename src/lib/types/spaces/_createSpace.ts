import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { accentCodes, permissionCodes, roleCodes } from '.';
import { type PartInsert, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { id0, type IdObj } from '../parts/partIds';

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
			...id0,
			ms: a.spaceMs,
			in_ms: a.spaceMs,
			code: pc.spaceDescriptionTxtIdAndMemberCountNum,
			num: 1,
			txt: a.spaceDescriptionTxt || '',
		},
		{
			...id0,
			ms: a.spaceMs,
			in_ms: a.spaceMs,
			code: pc.spacePinnedQueryTxtId,
			txt: a.spacePinnedQueryTxt || '',
		},
	];
	let supplementSpaceRows: PartInsert[] =
		a.spaceMs === a.callerMs
			? []
			: a.spaceMs === 1
				? [
						{
							...id0,
							ms: a.spaceMs,
							in_ms: a.spaceMs,
							code: pc.newMemberPermissionCodeNumId,
							num: permissionCodes.reactOnly,
						},
					]
				: [
						{
							...id0,
							ms: a.spaceMs,
							in_ms: a.spaceMs,
							code: pc.spaceIsPublicBinId,
							num: a.spaceIsPublicBin!,
						},
						{
							...id0,
							ms: a.spaceMs,
							in_ms: a.spaceMs,
							code: pc.spaceNameTxtId,
							txt: a.spaceNameTxt,
						},
						{
							...id0,
							ms: a.spaceMs,
							in_ms: a.spaceMs,
							code: pc.newMemberPermissionCodeNumId,
							num: a.newMemberPermissionCodeNum!,
						},
					];
	if (a.spaceMs !== a.callerMs && a.spaceMs !== 1) {
		if (a.spaceIsPublicBin === undefined) throw new Error(`Missing spaceIsPublicBin`);
		if (a.spaceNameTxt === undefined) throw new Error(`Missing spaceNameTxt`);
		if (a.newMemberPermissionCodeNum === undefined)
			throw new Error(`Missing newMemberPermissionCodeNum`);
	}
	return [...essentialRows, ...supplementSpaceRows];
};

export let makeRowsForJoiningSpace = (a: {
	ms: number;
	callerMs: number;
	inviteIdObj: IdObj;
	permissionCodeNum: number;
	roleCodeNum: number;
}) => [
	{
		...id0,
		at_ms: a.inviteIdObj.ms,
		at_by_ms: a.inviteIdObj.by_ms,
		at_in_ms: a.inviteIdObj.in_ms,
		ms: a.ms,
		by_ms: a.callerMs,
		code: pc.acceptMsByMsAtInviteId,
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.inviteIdObj.in_ms,
		code: pc.roleCodeNumIdAtAccountId,
		num: a.roleCodeNum,
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.inviteIdObj.in_ms,
		code: pc.permissionCodeNumIdAtAccountId,
		num: a.permissionCodeNum,
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.inviteIdObj.in_ms,
		code: pc.flairTxtIdAtAccountId,
		txt: '',
	},
	{
		...id0,
		at_ms: a.callerMs,
		ms: a.ms,
		in_ms: a.inviteIdObj.in_ms,
		code: pc.spacePriorityIdAccentCodeNumAtAccountId,
		num: accentCodes.none,
	},
];

export let _createSpace = async (
	input: WhoObj & {
		spaceNameTxt: string;
		spaceDescriptionTxt: string;
		spacePinnedQueryTxt: string;
		spaceIsPublicBin: number;
		newMemberPermissionCodeNum: number;
	},
) => {
	let ms = Date.now();
	await tdb
		.insert(pTable)
		.values([
			...makeNewSpaceRows({ ...input, spaceMs: ms }),
			...makeRowsForJoiningSpace({
				ms,
				callerMs: input.callerMs,
				inviteIdObj: { ms, by_ms: 0, in_ms: ms },
				roleCodeNum: roleCodes.admin,
				permissionCodeNum: permissionCodes.reactAndPost,
			}),
			{
				...id0,
				at_by_ms: 1,
				at_in_ms: 1,
				ms,
				in_ms: ms,
				code: pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt,
				num: 0,
				txt: '',
			},
		])
		.returning();
	return { ms };
};
