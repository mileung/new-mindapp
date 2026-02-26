import { isIdStr, isSpaceSlug } from '$lib/types/parts/partIds';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) =>
	isSpaceSlug(param) || isIdStr(param)) satisfies ParamMatcher;
