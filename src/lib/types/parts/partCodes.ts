// part code naming schema:
// if txt col is used, it's the first col name starting with _
// The order of the names is the p (priority) number (limited by "index by" comment)
// i: in_ms
// m: ms
// b: by_ms
// e.g. postImb: post in_ms (p1), ms (p2), by_ms (p3)
// Col names are generally split with a "_" unless using shorthand involving i, m, or b

// Use uniqueMapVals to ensure uniqueness

// import { uniqueMapVals } from '$lib/js';
// export let pc = uniqueMapVals({
export let pc = ((a) => a)({
	postImb_parentMb_rootMb_childCount: 0, // idx_code_p1_p2_p3 idx_code_p1_p3_p2 idx_code_p1_p5_p2 idx_code_p1_p6_p7
	_tag_imBy8_count: 1, // idx_code_p1_txt idx_code_p1_p2_p3 idx_code_p1_p4_p5_p6
	tagImb_postMb_lastVersion: 2, // idx_code_p1_p2_p3 idx_code_p1_p4_p5_p6
	_core_postImb_lastVersion_m: 3, // idx_code_p1_p2_p3
	tagImb_postMb_oldVersion: 4, // idx_code_p1_p4_p5_p6
	_core_postImb_oldVersion_m: 5, // idx_code_p1_p2_p3_p4
	_emoji_postImb_reactionBm: 6, // idx_code_p1_p2_p3_p4
	_emoji_postImb_count: 7, // idx_code_p1_p2_p3

	_spaceDescription_imb_memberCount: 8, // idx_code_p1
	imb_newMemberPermissionCode: 9, // idx_code_p1
	_spacePinnedQuery_imb: 10, // idx_code_p1
	imb_spaceIsPublic: 11, // idx_code_p1
	_spaceName_imb: 12, // idx_code_p1

	_slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs: 13, // idx_code_p1_p2 idx_code_p3
	i_accountMs_accentCode_lastViewMs_sidePriority: 14, // idx_code_p1_p2 idx_code_p1_p3_p4
	i_accountMs_roleCode_mb: 15, // idx_code_p1_p2 idx_code_p1_p3_p4
	i_accountMs_permCode_mb: 16, // idx_code_p1_p2
	acceptBm_inviteIbm: 17, // idx_code_p1_p3_p4
	_flair_i_accountMs_mb: 18, // idx_code_p1_p2

	_sessionKey_m_accountMs_expiryMs: 19, // idx_code_p1 idx_code_p2
	_clientKey_m_accountMs: 20, // idx_code_p1 idx_code_p2
	_accountEmail_bm: 21, // idx_code_p1 idx_code_txt
	_apiKey_m_accountMs_expiryMs: 22, // idx_code_p1
	_email_ms_strikeCount_pin: 23, // idx_code_p1
	_accountSavedTags_bm: 24, // idx_code_p1
	_accountPwHash_bm: 25, // idx_code_p1
	_accountName_bm: 26, // idx_code_p1
	_accountBio_bm: 27, // idx_code_p1

	_signedInEmailRules_mb: 28, // idx_code
	accountMs_banMb: 29, // idx_code_p1
});
