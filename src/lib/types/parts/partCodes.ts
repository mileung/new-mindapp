// part code naming schema:
// if txt col is used, it's the first col name starting with _
// The order of the names is the p (priority) number (limited by "index by" comment)
// i: in_ms
// m: ms
// b: by_ms
// e.g. postImb: post in_ms (p1), ms (p2), by_ms (p3)
// Col names are generally split with a "_" unless using shorthand involving i, m, or b

import { uniqueMapVals } from '$lib/js';

// comment next line during `bun run db:push`
export let pc = uniqueMapVals({
	// uncomment next line during `bun run db:push`
	// export let pc = ((a) => a)({
	postImb_parentMb_rootMb_childCount: 0, // idx_code_p1_to_p3 idx_code_p1_p3_p2 idx_code_p1_p5_p2 idx_code_p1_p6_p7
	tagImb_postMb_lastVersion: 1, // idx_code_p1_to_p3 idx_code_p1_p4_p5_p6
	_core_postImb_lastVersion_m: 2, // idx_code_p1_to_p3
	_tag_imBy8_count: 3, // idx_code_p1_txt idx_code_p1_to_p3 idx_code_p1_p4_p5_p6
	tagImb_postMb_oldVersion: 4, // idx_code_p1_p4_p5_p6
	_core_postImb_oldVersion_m: 5, // idx_code_p1_to_p4
	_emoji_postImb_count: 6, // idx_code_p1_to_p3
	_emoji_postImb_reactionBm: 7, // idx_code_p1_to_p4
	_email_ms_strikeCount_pin: 8, // idx_code_p1

	_spaceName_imb: 9, // idx_code_p1
	imb_spaceIsPublic: 10, // idx_code_p1
	_spacePinnedQuery_imb: 11, // idx_code_p1
	_spaceDescription_imb_memberCount: 12, // idx_code_p1
	acceptBm_inviteIbm: 13, // idx_code_p1_p3_p4
	_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs: 14, // idx_code_p1_p2 idx_code_p3
	imb_newMemberPermissionCode: 15, // idx_code_p1

	_accountName_bm: 16, // idx_code_p1
	_accountSavedTags_bm: 17, // idx_code_p1
	_accountBio_bm: 18, // idx_code_p1
	_accountEmail_bm: 19, // idx_code_p1 idx_code_txt
	_accountPwHash_bm: 20, // idx_code_p1
	_sessionKey_m_accountMs_expiryMs: 21, // idx_code_p1 idx_code_p2
	_clientKey_m_accountMs: 22, // idx_code_p1 idx_code_p2
	_apiKey_m_accountMs_expiryMs: 23, // idx_code_p1
	_flair_i_accountMs_mb: 24, // idx_code_p1_p2
	i_accountMs_permCode_mb: 25, // idx_code_p1_p2
	i_accountMs_roleCode_mb: 26, // idx_code_p1_p2 idx_code_p1_p3_p4
	i_accountMs_accentCode_lastViewMs_sidePriority: 27, // idx_code_p1_p2 idx_code_p1_p3_p4
	accountMs_banMb: 28, // idx_code_p1
	_signedInEmailRules_mb: 29, // idx_code
});
