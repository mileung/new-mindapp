import { ALLOWED_ICONS } from '$lib/js';
import { icons } from '@iconify-json/tabler/index.js';
import { getIconData } from '@iconify/utils';
import type { LayoutServerLoad } from './$types';

let iconsSlice = ALLOWED_ICONS.reduce(
	(a, name) => ({
		...a,
		[name]: getIconData(icons, name)!.body,
	}),
	{} as Record<string, string>,
);
export const load: LayoutServerLoad = async (e) => {
	e.setHeaders({
		'Cross-Origin-Embedder-Policy': 'require-corp',
		'Cross-Origin-Opener-Policy': 'same-origin',
	});
	return {
		iconsSlice,
	};
};
