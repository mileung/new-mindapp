import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	event.setHeaders({
		'Cross-Origin-Embedder-Policy': 'require-corp',
		'Cross-Origin-Opener-Policy': 'same-origin',
	});

	let sessionIdExists = !!event.cookies.get('sessionId');

	return {
		sessionIdExists,
	};
};
