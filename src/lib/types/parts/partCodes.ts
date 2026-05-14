import { uniqueMapVals } from '$lib/js';

export let pc = uniqueMapVals({
	postId__parentPostId_lastVersion: 0,
	childPostId__rootId_depth: 1,
	postId__citedPostId: 2,
	reactionId__postId__emoji: 3,
	// TODO: Calendar events? Just make it a reserved tag?

	ms__postId_currentVersion: 10,
	ms__postId_exVersion: 11,
	ms__postId_currentSoftDeletedVersion: 12,
	ms__postId_exSoftDeletedVersion: 13,

	currentPostTagId__postId_version: 20,
	exPostTagId__postId_version: 21,

	// TODO: numAtTag  AtPostId: 30,
	// ot numAtTagId8: 30,
	// basically attach the num field to a tag
	// latitude:123.456789
	// latitude
	// 123.456789
	// Tag Name=23423.234234
	// TagTxtVal
	// TagNumVal
	// TagTxtSubVal
	// TagNumSubVal
	// TagSubTxt
	// TagSubNum
	// TagId8SubTxtAtPostIdWithInMsAsVersion
	// TagId8SubNumAtPostIdWithInMsAsVersion

	// Tag
	// TagWithParsedNum
	// year=2026
	// month=1
	// day=31
	// hour=31
	// TagWithParsedDate

	currentPostCoreId__postId_version: 22,
	exPostCoreId__postId_version: 23,

	// prob won't do this:
	// tagId
	// tagTxtAtId
	// tagCountAtSpaceId

	tagId8_count_txt: 30,
	coreId8_count_txt: 31,
	postId_count_emoji: 32,
	// TODO?: citeCount__inMsIdAtPostId: 33,

	id_spaceIsPublic: 40,
	id__spaceName: 41,
	id_memberCount_spaceDescription: 42,
	id__spacePinnedQuery: 43,
	id_newMemberPermissionCode: 44,
	id__accountMs_roleCode: 45,
	id__accountMs_permissionCode: 46,
	id__accountMs__flair: 47, // TODO: Indicate if the flair by_ms is a mod/admin
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
	// TODO: acceptMs_ByMs_LastWriteMsIdAtInviteId: 71,

	postId__bumpedRootId: 80,
	// lastSpaceViewId: 81,
	// lastSpacePostId: 82,
	// TODO: tagIdAtBumpedRootIdWithNumAsMs: 83,
	// lastSpacePostMsAtLastSpaceViewId: 81,

	id__signedInEmailRules: 90,
	banMsByMs__accountMs: 91,
	// banIdAtSpaceId: 92,
});
