import { goto } from '$app/navigation';
import { page } from '$app/state';
import { gs } from '$lib/global-state.svelte';
import { identikana } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import type { LayoutServerData } from '../../../routes/$types';
import {
	getWhoObj,
	getWhoWhereObj,
	GranularBinPropByMsSchema,
	GranularTxtPropByMsSchema,
} from '../parts';
import { getUrlInMs } from '../parts/partIds';

export let SpaceSchema = z
	.object({
		ms: z.number(),
		name: GranularTxtPropByMsSchema,
		description: GranularTxtPropByMsSchema,
		isPublic: GranularBinPropByMsSchema,
		newUsersCanReact: GranularBinPropByMsSchema,
		newUsersCanPost: GranularBinPropByMsSchema,
	})
	.strict();
export type Space = z.infer<typeof SpaceSchema>;

export let defaultSpaceProps: Space = {
	ms: 0,
	name: { ms: 0, by_ms: 0, txt: '' },
	description: { ms: 0, by_ms: 0, txt: '' },
	isPublic: { ms: 0, by_ms: 0, num: 0 },
	newUsersCanReact: { ms: 0, by_ms: 0, num: 0 },
	newUsersCanPost: { ms: 0, by_ms: 0, num: 0 },
};

export let InviteSchema = z
	.object({
		ms: z.number(),
		by_ms: z.number(),
		in_ms: z.number(),
		slug: z.string(),
		byNameTxt: z.string(),
		space: SpaceSchema,
		revoked: z
			.object({
				ms: z.number(),
				by_ms: z.number(),
				byNameTxt: z.string(),
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
	canReactBin: {
		num: number;
		ms: number;
		by_ms: number;
	};
	canPostBin: {
		num: number;
		ms: number;
		by_ms: number;
	};
	promo?: {
		owner?: true;
		ms: number;
		by_ms: number;
	};
};

export let getPromptSigningIn = () => {
	let urlInMs = getUrlInMs();
	let signedIn = (page.data as LayoutServerData).sessionExists || !!gs.accounts?.[0].ms;
	if (signedIn) return false;
	if (urlInMs === 8 || urlInMs === undefined) return true;
	if (!urlInMs || urlInMs === 1) return false;
	return page.url.pathname.endsWith('/dots');
};

export let spaceMsToNameTxt = (ms: number) => {
	return ms === 8 || ms === gs.accounts?.[0].ms
		? m.personal()
		: ms === 1
			? m.global()
			: ms
				? gs.msToSpaceNameTxtMap[ms] || identikana(ms)
				: m.local();
};

export let usePendingInvite = async () => {
	if (gs.pendingInvite) {
		let { redeemed } = await trpc().checkInvite.mutate({
			...(await getWhoObj()),
			inviteSlug: gs.pendingInvite.slug,
			useIfValid: true,
		});
		console.log('redeemed:', redeemed);
		redeemed //
			? goto(`/__${gs.pendingInvite.in_ms}`)
			: alert(m.invalidInvite());
		gs.pendingInvite = undefined;
	}
};

export let getCurrentSpacePermissions = () => {
	let urlInMs = getUrlInMs();
	let canReact = false;
	let canPost = false;
	if (urlInMs !== undefined && gs.accounts) {
		if (!urlInMs || urlInMs === gs.accounts[0].ms) {
			canReact = true;
			canPost = true;
		} else if (gs.accounts) {
			let membership = gs.accountMsToSpaceMsToMembershipMap[gs.accounts[0].ms]?.[urlInMs];
			if (membership) {
				canReact = !!membership.canReactBin.num;
				canPost = !!membership.canPostBin.num;
			}
		}
	}
	return { canReact, canPost };
};

export let updateCurrentSpaceMembership = async () => {
	let whoWhereObj = await getWhoWhereObj();
	let membership: null | Membership = null;
	if (whoWhereObj.callerMs && whoWhereObj.spaceMs && whoWhereObj.callerMs !== whoWhereObj.spaceMs) {
		membership = (await trpc().getMySpaceMembership.query(whoWhereObj)).membership;
	}
	console.log('membership:', membership);
	gs.accountMsToSpaceMsToMembershipMap = {
		...gs.accountMsToSpaceMsToMembershipMap,
		[whoWhereObj.callerMs]: {
			...gs.accountMsToSpaceMsToMembershipMap[whoWhereObj.callerMs],
			[whoWhereObj.spaceMs]: membership,
		},
	};
};
