import { uniqueMapVals } from '$lib/js';

export let pc = uniqueMapVals({
	postIdLastVersionNumAtParentPostId: 0,
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

	// prob won't do this:
	// tagId
	// tagTxtAtId
	// tagCountAtSpaceId

	tagId8AndTxtWithNumAsCount: 30,
	coreId8AndTxtWithNumAsCount: 31,
	postIdRxnEmojiTxtAndCountNum: 32,
	// TODO?: citeCount__inMsIdAtPostId: 33,

	spaceIsPublicBinId: 40,
	spaceNameTxtId: 41,
	spaceDescriptionTxtIdAndMemberCountNum: 42,
	spacePinnedQueryTxtId: 43,
	newMemberPermissionCodeNumId: 44,
	roleCodeNumIdAtAccountId: 45,
	permissionCodeNumIdAtAccountId: 46,
	flairTxtIdAtAccountId: 47, // TODO: Indicate if the flair by_ms is a mod/admin
	spacePriorityIdAccentCodeNumAtAccountId: 48,

	accountEmailTxtMsByMs: 50,
	accountPwHashTxtMsByMs: 51,
	accountNameTxtMsByMs: 52,
	accountBioTxtMsByMs: 53,
	accountSavedTagsTxtMsByMs: 54,

	clientKeyTxtMsAtAccountId: 60,
	sessionKeyTxtMs_ExpiryMs_AtAccountId: 61,
	otpMs_Pin_StrikeCountIdAndEmailTxt: 62,

	inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt: 70,
	acceptMsByMsAtInviteId: 71,
	// TODO: acceptMs_ByMs_LastWriteMsIdAtInviteId: 71,

	postIdAtBumpedRootId: 80,
	lastSpaceViewId: 81,
	lastSpacePostId: 82,
	// TODO: tagIdAtBumpedRootIdWithNumAsMs: 83,
	// lastSpacePostMsAtLastSpaceViewId: 81,

	signedInEmailRulesTxtId: 90,
	banMsByMsAtAccountId: 91,
	// banIdAtSpaceId: 92,
});
