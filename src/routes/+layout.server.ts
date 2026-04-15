import { splitUntil } from '$lib/js';
import { formatMs } from '$lib/time';
import { getIdStrAsIdObj, isIdStr, isSpaceSlug } from '$lib/types/parts/partIds';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	event.setHeaders({
		'Cross-Origin-Embedder-Policy': 'require-corp',
		'Cross-Origin-Opener-Policy': 'same-origin',
	});

	let title: undefined | string;
	let thinTopOgText: undefined | string;
	let boldBottomOgText: undefined | string;

	let ua = event.request.headers.get('user-agent') || '';
	let needsOG = /facebookexternalhit|Facebot|Twitterbot/.test(ua.slice(117));

	if (needsOG) {
		// console.log('needsOG:', needsOG);
		// console.log('event.url.pathname:', event.url.pathname);
		console.log('stuff:', event.request.headers.values());
		let slug = splitUntil(event.url.pathname, '/', 2)[1];
		console.log('slug:', slug);

		if (isSpaceSlug(slug)) {
			let lastSeenInMs = +slug.slice(2);
			console.log('lastSeenInMs:', lastSeenInMs);
			boldBottomOgText = 'spaceName';
		}
		if (isIdStr(slug)) {
			let idObj = getIdStrAsIdObj(slug);
			console.log('idObj:', idObj);
			thinTopOgText = 'post core'.slice(0, 998);
			let time = formatMs(0, 'min');
			let authorName = 'Mike';
			let spaceName = 'Global';
			boldBottomOgText = `${time}\n${authorName}\n${spaceName}`;
		}
	}

	return {
		title,
		thinTopOgText,
		boldBottomOgText,
	};
};
