import { goto } from '$app/navigation';
import { page } from '$app/state';
import { gs } from '$lib/global-state.svelte';
import { m } from '$lib/paraglide/messages';
import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import type { LayoutServerData } from '../../../routes/$types';
import { getWhoObj, GranularBinPropByMsSchema, GranularTxtPropByMsSchema } from '../parts';
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

export let getPromptSigningIn = () => {
	let urlInMs = getUrlInMs();
	let signedIn = (page.data as LayoutServerData).sessionExists || !!gs.accounts?.[0].ms;
	if (signedIn) return false;
	if (urlInMs === 8 || urlInMs === undefined) return true;
	if (!urlInMs || urlInMs === 1) return false;
	return page.url.pathname.endsWith('/dots');
};

export let spaceMsToName = (ms: number) => {
	return ms === 8 || ms === gs.accounts?.[0].ms
		? { ms: 0, by_ms: 0, txt: m.personal() }
		: ms === 1
			? { ms: 0, by_ms: 0, txt: m.global() }
			: ms
				? gs.msToSpaceNameMap[ms] || { ms: 0, by_ms: 0, txt: '' }
				: { ms: 0, by_ms: 0, txt: m.local() };
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
