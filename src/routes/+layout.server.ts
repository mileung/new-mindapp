import { getRequestEnablesSqlocal, splitUntil } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { assertLt2Rows, channelPartsByCode } from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { getIdStrAsIdObj, isIdStr, isProfileSlug, isSpaceSlug } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	// event.setHeaders({
	// 	'Cross-Origin-Embedder-Policy': 'require-corp',
	// 	'Cross-Origin-Opener-Policy': 'same-origin',
	// });

	let thinTopOgText: undefined | string;
	let boldBottomOgText: undefined | string;

	let ua = event.request.headers.get('user-agent') ?? '';
	let needsOG = /facebookexternalhit|Facebot|Twitterbot/.test(ua.slice(117));

	if (needsOG) {
		// console.log('event.url.pathname:', event.url.pathname);
		// console.log('stuff:', event.request.headers.values());
		// console.log('slug:', slug);
		let slug = splitUntil(event.url.pathname, '/', 2)[1];
		let slugAsIdObj = isIdStr(slug) && getIdStrAsIdObj(slug);
		let slugIsSpace = isSpaceSlug(slug);
		let slugIsProfile = isProfileSlug(slug);
		let {
			[pc._core_postImb_lastVersion_m]: _core_postImb_lastVersion_mRows = [],
			[pc.imb_spaceIsPublic]: imb_spaceIsPublicRows = [],
			[pc._accountName_bm]: _accountName_bmRows = [],
			[pc._spaceName_imb]: _spaceName_imbRows = [],
		} = channelPartsByCode(
			slugAsIdObj || slugIsSpace || slugIsProfile
				? await tdb
						.select()
						.from(pTable)
						.where(
							or(
								slugAsIdObj
									? and(
											pf.code.eq(pc._core_postImb_lastVersion_m),
											pf.p1.eq(slugAsIdObj.in_ms),
											pf.p2.eq(slugAsIdObj.ms),
											pf.p3.eq(slugAsIdObj.by_ms),
										)
									: undefined,
								slugIsSpace || slugAsIdObj
									? and(
											or(
												pf.code.eq(pc.imb_spaceIsPublic),
												pf.code.eq(pc._spaceName_imb), //
											),
											pf.p1.eq(+slug.slice(0, slug.indexOf('_'))),
										)
									: undefined,
								slugAsIdObj || slugIsProfile
									? and(
											pf.code.eq(pc._accountName_bm),
											pf.p1.eq(+slug.slice(slug.lastIndexOf('_') + 1, slug.length)),
										)
									: undefined,
							),
						)
				: [],
		);
		let profileNameTxt = assertLt2Rows(_accountName_bmRows)?.txt || undefined;
		let isGlobalSpace = +slug.slice(0, slug.indexOf('_')) === 1;
		if (isGlobalSpace || assertLt2Rows(imb_spaceIsPublicRows)?.p4) {
			let spaceNameTxt = isGlobalSpace
				? m.global()
				: assertLt2Rows(_spaceName_imbRows)?.txt! || undefined;
			if (slugIsSpace) {
				boldBottomOgText = spaceNameTxt;
			} else if (slugAsIdObj) {
				let { txt, p5 } = assertLt2Rows(_core_postImb_lastVersion_mRows) || {};
				if (txt && p5) {
					thinTopOgText = txt.slice(0, 998);
					boldBottomOgText = `${profileNameTxt} | ${spaceNameTxt}`;
				}
			}
		} else if (slugIsProfile) {
			let { txt, p5 } = assertLt2Rows(_accountName_bmRows) || {};
			if (txt && p5) {
				thinTopOgText = txt.slice(0, 998);
				boldBottomOgText = txt;
			}
		}
	}

	return {
		thinTopOgText,
		boldBottomOgText,
		sqlocalOk: getRequestEnablesSqlocal(event.request),
	};
};
