import { isIdStr } from '$lib/types/parts/partIds';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => isIdStr(param)) satisfies ParamMatcher;
