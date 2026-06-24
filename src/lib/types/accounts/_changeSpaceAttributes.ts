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
	let now = Date.now();
	// console.log('input:', input);
	if (input.nameTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				txt: input.nameTxt,
				p2: now, //
				p3: input.callerMs,
			})
			.where(
				and(
					pf.code.eq(pc._spaceName_imb),
					pf.p1.eq(input.spaceMs), //
				),
			);
	}
	if (input.descriptionTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				txt: input.descriptionTxt,
				p2: now, //
				p3: input.callerMs,
			})
			.where(
				and(
					pf.code.eq(pc._spaceDescription_imb_memberCount),
					pf.p1.eq(input.spaceMs), //
				),
			);
	}
	if (input.pinnedQueryTxt !== undefined) {
		await tdb
			.update(pTable)
			.set({
				txt: input.pinnedQueryTxt,
				p2: now, //
				p3: input.callerMs,
			})
			.where(
				and(
					pf.code.eq(pc._spacePinnedQuery_imb),
					pf.p1.eq(input.spaceMs), //
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
		await tdb
			.update(pTable)
			.set({
				p2: now,
				p3: input.callerMs,
				p4: input.isPublicNum,
			})
			.where(
				and(
					pf.code.eq(pc.imb_spaceIsPublic),
					pf.p1.eq(input.spaceMs), //
				),
			);
	}
	if (input.newMemberPermissionCodeNum !== undefined) {
		await tdb
			.update(pTable)
			.set({
				p2: now,
				p3: input.callerMs,
				p4: input.newMemberPermissionCodeNum,
			})
			.where(
				and(
					pf.code.eq(pc.imb_newMemberPermissionCode),
					pf.p1.eq(input.spaceMs), //
				),
			);
	}
	return { ms: now };
};
