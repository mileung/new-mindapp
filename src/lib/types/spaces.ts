import { z } from 'zod';
import { goto } from '$app/navigation';
import { updateLocalCache } from './local-cache';

export let SpaceSchema = z
	.object({
		ms: z.number(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;

export let changeCurrentSpace = (inMs: number | '', noGo = false) => {
	!noGo && goto(`/__${inMs}`);
	localStorage.setItem('currentSpaceMs', '' + inMs);
	updateLocalCache((lc) => {
		lc.currentSpaceMs = inMs;
		return lc;
	});
};
