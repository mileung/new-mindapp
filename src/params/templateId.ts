// import { isTemplateId } from '$lib/types/parts';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => {
	// return isTemplateId(param);
	return true;
}) satisfies ParamMatcher;
