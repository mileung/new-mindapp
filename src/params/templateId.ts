import { isTemplateId } from '$lib/types/parts/partIds';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string) => isTemplateId(param)) satisfies ParamMatcher;
