import { z } from 'zod';
import { gs } from './global-state.svelte';

export let SpaceSchema = z
	.object({
		ms: z.number(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;

export let getCurrentSpaceMs = () => gs.accounts[0]?.currentSpaceMs || '';
