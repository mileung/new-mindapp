import { uniqueMapVals } from '$lib/js';

export let pc = uniqueMapVals({
	postIdWithNumAsLastVersionAtParentPostId: 0,
	childPostIdWithNumAsDepthAtRootId: 1,
	postIdAtCitedPostId: 2,
	reactionIdWithEmojiTxtAtPostId: 3,
	// TODO: Calendar events? Just make it a reserved tag?

	currentVersionNumMsAtPostId: 10,
	exVersionNumMsAtPostId: 11,
	currentSoftDeletedVersionNumMsAtPostId: 12,
	exSoftDeletedVersionNumMsAtPostId: 13,

	currentPostTagIdWithVersionNumAtPostId: 20,
	exPostTagIdWithVersionNumAtPostId: 21,

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

	currentPostCoreIdWithVersionNumAtPostId: 22,
	exPostCoreIdWithVersionNumAtPostId: 23,

	tagId8AndTxtWithNumAsCount: 30,
	coreId8AndTxtWithNumAsCount: 31,
	reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId: 32,

	spaceIsPublicBinId: 40,
	spaceNameTxtIdAndMemberCountNum: 41,
	spaceDescriptionTxtId: 42,
	spacePinnedQueryTxtId: 43,
	newMemberPermissionCodeId: 44,
	permissionCodeNumIdAtAccountId: 45,
	roleCodeNumIdAtAccountId: 46,

	accountEmailTxtMsByMs: 50,
	accountPwHashTxtMsByMs: 51,
	accountNameTxtMsByMs: 52,
	accountBioTxtMsByMs: 53,
	accountSavedTagsTxtMsByMs: 54,
	accountSpaceMssTxtMsByMs: 55,

	clientKeyTxtMsAtAccountId: 60,
	sessionKeyTxtMsAtAccountId: 61,
	createAccountOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount: 62,
	signInOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount: 63,
	resetPasswordOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount: 64,

	inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug: 70,
	acceptMsByMsAtInviteId: 71,
	revokeMsByMsAtInviteId: 72,

	postIdAtBumpedRootId: 80,
	lastSpaceViewId: 81,
	lastSpacePostId: 82,
	// TODO: tagIdAtBumpedRootIdWithNumAsMs: 83,
	// lastSpacePostMsAtLastSpaceViewId: 81,
});
