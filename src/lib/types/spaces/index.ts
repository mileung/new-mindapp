import { page } from '$app/state';
import { gs } from '$lib/global-state.svelte';
import { z } from 'zod';
import type { LayoutServerData } from '../../../routes/$types';
import { type IdObj } from '../parts/partIds';

export let SpaceSchema = z
	.object({
		ms: z.number(),
		name: z.string().optional(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;

export let getPromptSigningIn = (idParamObj: null | IdObj) => {
	if (!idParamObj) return true;
	return (
		(!(page.data as LayoutServerData).sessionIdExists || gs.accounts?.[0].ms === 0) &&
		idParamObj.in_ms !== 0 &&
		idParamObj.in_ms !== 1
	);
};
