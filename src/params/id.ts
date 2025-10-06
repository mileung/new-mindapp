import { isId } from '$lib/types/thoughts';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => {
	return isId(param);
}) satisfies ParamMatcher;
