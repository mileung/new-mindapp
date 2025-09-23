import { isId } from '$lib/thoughts';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => {
	return isId(param);
}) satisfies ParamMatcher;
