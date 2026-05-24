import { uniqueMapVals } from '$lib/js';

// part code naming schema: <id>__<at_id>_<num>_<txt>
// <id> schema: <ms>_<by_ms>_<in_ms>
// <at_id> schema: <at_ms>_<at_by_ms>_<at_in_ms>
// <id> and <at_id> may have their values repurposed for efficiency
// omit __<at_id> if no at id
// omit _<num>_<txt> if no num or txt
// omit <num> if no num
// omit _<txt> if no txt

export let pc = uniqueMapVals({
	postId__parentPostId_lastVersion: 0,
	childPostId__rootId_depth: 1,
	reactionId__postId__emoji: 3,

	postId__ms_sd_lastVersion__core: 10, // sd is a binary flag for softDeleted
	postId__ms_sd_oldVersion__core: 11, // if sd=1, core should be null

	postTagId__postId_lastVersion: 20,
	postTagId__postId_oldVersion: 21,
	// postTagId__postMsByMs_lastVersion_val_val: 20,
	// postTagId__postMsByMs_oldVersion_val_val: 21,

	idBy8__count_val_tag: 30, // val is only notNull if tag.endsWith(`=<number>`)
	// idBy8__isKey_count__tag: 30,
	postId_count_emoji: 32,

	id_spaceIsPublic: 40,
	id__spaceName: 41,
	id_memberCount_spaceDescription: 42,
	id__spacePinnedQuery: 43,
	id_newMemberPermissionCode: 44,
	id__accountMs_roleCode: 45,
	id__accountMs_permissionCode: 46,
	id__accountMs__flair: 47,
	spacePriorityId__accountMs_accentCode: 48,

	msByMs__accountEmail: 50,
	msByMs__accountPwHash: 51,
	msByMs__accountName: 52,
	msByMs__accountBio: 53,
	msByMs__accountSavedTags: 54,

	ms__accountMs__clientKey: 60,
	ms_ExpiryMs__accountMs__sessionKey: 61,
	otpMs_pin_strikeCount__email: 62,

	inviteId__expiryMs_useCount_maxUses_revokedMs_slugEnd: 70,
	acceptMsByMs__inviteId: 71,

	// lastSpaceViewId: 81,
	// lastSpacePostId: 82,
	// lastSpacePostMsAtLastSpaceViewId: 81,

	id__signedInEmailRules: 90,
	banMsByMs__accountMs: 91,
});
