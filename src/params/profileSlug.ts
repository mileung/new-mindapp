import { isProfileSlug } from '$lib/types/parts/partIds';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => isProfileSlug(param)) satisfies ParamMatcher;
