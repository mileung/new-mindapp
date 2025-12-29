import { goto } from '$app/navigation';
import { page } from '$app/state';
import { gs } from '$lib/global-state.svelte';
import { identikana } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { trpc } from '$lib/trpc/client';
import { z } from 'zod';
import type { LayoutServerData } from '../../../routes/$types';
import { getWhoObj } from '../parts';
import { getIdStrAsIdObj } from '../parts/partIds';

export let SpaceSchema = z
	.object({
		ms: z.number(),
		name: z.string().optional(),
		description: z.string().optional(),
	})
	.strict();
export type Space = z.infer<typeof SpaceSchema>;

export let InviteSchema = z
	.object({
		ms: z.number(),
		by_ms: z.number(),
		in_ms: z.number(),
		slug: z.string(),
		inviterName: z.string().optional(),
		spaceName: z.string().optional(),
		accepted: z
			.object({
				ms: z.number(),
				by_ms: z.number(),
				byName: z.string().optional(),
			})
			.optional(),
		revoked: z
			.object({
				ms: z.number(),
				by_ms: z.number(),
				byName: z.string().optional(),
			})
			.optional(),
	})
	.strict();
export type Invite = z.infer<typeof InviteSchema>;

export let getPromptSigningIn = () => {
	let idParamObj = page.params.id && getIdStrAsIdObj(page.params.id);
	let signedIn = (page.data as LayoutServerData).sessionExists || gs.accounts?.[0].ms! > 0;
	if (signedIn) return false;
	if (!idParamObj) return true;
	if (!idParamObj.in_ms) return false;
	return (
		page.url.pathname.endsWith('/dots') || //
		(idParamObj.in_ms !== 0 && idParamObj.in_ms !== 1)
	);
};

export let spaceMsToName = (ms: number) => {
	return ms === 8
		? m.personal()
		: ms === 1
			? m.global()
			: ms
				? gs.msToSpaceMap[ms]?.name || identikana(ms)
				: m.local();
};

export let usePendingInvite = async () => {
	if (gs.pendingInvite) {
		let { redeemed } = await trpc().checkInvite.mutate({
			...(await getWhoObj()),
			inviteSlug: gs.pendingInvite.slug,
			useIfValid: true,
		});
		redeemed //
			? goto(`/__${gs.pendingInvite.in_ms}`)
			: alert(m.invalidInvite());
	}
};
