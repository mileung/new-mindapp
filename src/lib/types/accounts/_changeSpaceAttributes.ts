import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _changeSpaceAttributes = async (
	input: WhoWhereObj & {
		nameTxt?: string;
		descriptionTxt?: string;
		pinnedQueryTxt?: string;
		isPublicNum?: number;
		newMemberPermissionCodeNum?: number;
	},
) => {
	let ms = Date.now();
	// console.log('input:', input);
	if (input.nameTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				ms, //
				by_ms: input.callerMs,
				txt: input.nameTxt,
			})
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.in_ms.eq(input.spaceMs),
					pf.code.eq(pc.id__spaceName),
					pf.num.isNull,
					pf.txt.isNotNull,
				),
			);
	}
	if (input.descriptionTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				ms, //
				by_ms: input.callerMs,
				txt: input.descriptionTxt,
			})
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.in_ms.eq(input.spaceMs),
					pf.code.eq(pc.id_memberCount_spaceDescription),
					pf.num.gt0,
					pf.txt.isNotNull,
				),
			);
	}
	if (input.pinnedQueryTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				ms, //
				by_ms: input.callerMs,
				txt: input.pinnedQueryTxt,
			})
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.in_ms.eq(input.spaceMs),
					pf.code.eq(pc.id__spacePinnedQuery),
					pf.num.isNull,
					pf.txt.isNotNull,
				),
			);
	}
	if (input.isPublicNum !== undefined) {
		if (input.isPublicNum) {
			// This, like all other functions interacting with the db, assume inputs are authorized by _getCallerContext.
			// So it should be impossible for input.spaceMs to be a space the caller is not a member of.
			// Therefore it should also be impossible for input.callerMs to be a member of another account's personal space.
			// This applies to _createInviteLink as well.
			// It should be impossible to invite another account to your personal space.
			// Therefore it should also be impossible for a personal input.spaceMs to be different from input.callerMs.
			if (input.spaceMs === input.callerMs) throw new Error(`Personal space cannot be made public`);
		} else if (input.spaceMs === 1) throw new Error(`Global space cannot be made private`);
		console.log('input.isPublicNum:', input.isPublicNum);
		await tdb
			.update(pTable)
			.set({
				ms,
				by_ms: input.callerMs,
				num: input.isPublicNum,
			})
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0, //
					pf.in_ms.eq(input.spaceMs),
					pf.code.eq(pc.id_spaceIsPublic),
				),
			);
	}
	if (input.newMemberPermissionCodeNum !== undefined) {
		await tdb
			.update(pTable)
			.set({
				ms, //
				by_ms: input.callerMs,
				num: input.newMemberPermissionCodeNum,
			})
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.in_ms.eq(input.spaceMs),
					pf.code.eq(pc.id_newMemberPermissionCode),
				),
			);
	}
	return { ms };
};
