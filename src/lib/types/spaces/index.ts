import { goto } from '$app/navigation';
import { page } from '$app/state';
import { gs } from '$lib/global-state.svelte';
import { identikana, uniqueMapVals } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import { getWhoObj, GranularNumPropSchema, GranularTxtPropSchema } from '../parts';

export let roleCodes = uniqueMapVals({
	member: 0,
	mod: 1,
	owner: 2,
});

export let permissionCodes = uniqueMapVals({
	// TODO: use bitmasking if this gets more complex?
	viewOnly: 0,
	reactOnly: 1,
	postOnly: 2,
	reactAndPost: 3,
});

export let SpaceSchema = z
	.object({
		ms: z.number(),
		memberCount: z.number(),
		isPublic: GranularNumPropSchema,
		name: GranularTxtPropSchema,
		description: GranularTxtPropSchema,
		pinnedQuery: GranularTxtPropSchema,
		newMemberPermissionCode: GranularNumPropSchema,
	})
	.strict();
export type Space = z.infer<typeof SpaceSchema>;

export let defaultSpaceProps: Space = {
	ms: 0,
	memberCount: 0,
	isPublic: { ms: 0, by_ms: 0, num: 0 },
	name: { ms: 0, by_ms: 0, txt: '' },
	description: { ms: 0, by_ms: 0, txt: '' },
	pinnedQuery: { ms: 0, by_ms: 0, txt: '' },
	newMemberPermissionCode: { ms: 0, by_ms: 0, num: 0 },
};

export let InviteSchema = z
	.object({
		ms: z.number(),
		by_ms: z.number(),
		in_ms: z.number(),
		slug: z.string(),
		expiryMs: z.number(),
		revoked: z
			.object({
				ms: z.number(),
				by_ms: z.number(),
			})
			.optional(),
	})
	.strict();
export type Invite = z.infer<typeof InviteSchema>;

export type Membership = {
	invite: {
		by_ms: number;
		in_ms: number;
	};
	accept: {
		ms: number;
		by_ms: number;
	};
	permission: {
		num: number;
		ms: number;
		by_ms: number;
	};
	role: {
		num: number;
		ms: number;
		by_ms: number;
	};
};

export let getPromptSigningIn = () => {
	let signedIn = !!gs.accounts?.[0].ms;
	// let signedIn = (page.data as LayoutServerData).sessionExists || !!gs.accounts?.[0].ms;
	if (signedIn) return false;
	if (gs.urlInMs === 8 || gs.urlInMs === undefined) return true;
	if (!gs.urlInMs || gs.urlInMs === 1) return false;
	return page.url.pathname.endsWith('/dots');
};

export let spaceMsToNameTxt = (ms: number) => {
	return ms === 8 || (ms && ms === gs.accounts?.[0].ms)
		? m.personal()
		: ms === 1
			? m.global()
			: ms
				? gs.msToSpaceNameTxtMap[ms] || identikana(ms)
				: m.local();
};

export let usePendingInvite = async () => {
	if (gs.accounts !== undefined && gs.pendingInvite) {
		let { redeemed } = await trpc().checkInvite.mutate({
			...(await getWhoObj()),
			inviteSlug: gs.pendingInvite.slug,
			useIfValid: true,
		});
		// console.log('redeemed:', redeemed);
		redeemed //
			? goto(`/__${gs.pendingInvite.in_ms}`)
			: alert(m.invalidInvite());
		gs.accountMsToSpaceMsToCheckedMap = {
			...gs.accountMsToSpaceMsToCheckedMap,
			[gs.accounts[0].ms]: {
				...gs.accountMsToSpaceMsToCheckedMap[gs.accounts[0].ms],
				[gs.pendingInvite.in_ms]: false,
			},
		};
		gs.pendingInvite = undefined;
	}
};
