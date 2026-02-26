import { isSpaceSlug } from '$lib/types/parts/partIds';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => isSpaceSlug(param)) satisfies ParamMatcher;
