import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	// event.setHeaders({
	// 	'Cross-Origin-Embedder-Policy': 'require-corp',
	// 	'Cross-Origin-Opener-Policy': 'same-origin',
	// });

	let sessionExists = !!event.cookies.get('sessionKey');
	return {
		sessionExists,
	};
};
