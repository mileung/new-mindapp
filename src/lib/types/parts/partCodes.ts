type UniqueValues<T extends Record<string, number>> = {
	[K in keyof T]: T[K] extends T[Exclude<keyof T, K>] ? never : T[K];
};
let uniqueMapVals = <const T extends Record<string, number>>(dict: UniqueValues<T>): T => dict;

export let pc = uniqueMapVals({
	postIdWithNumAsLastVersionAtParentPostId: 0,
	childPostIdWithNumAsDepthAtRootId: 1, // TODO: grandchildren and later
	// remoteDescendantPostIdWithNumAsDepthAtRootId
	// NumAsDepth isn't actually necessary
	postIdAtCitedPostId: 2,
	reactionIdWithEmojiTxtAtPostId: 3,
	// TODO: Calendar events? Just make it a reserved tag?

	currentVersionNumMsAtPostId: 10,
	exVersionNumMsAtPostId: 11,
	currentSoftDeletedVersionNumMsAtPostId: 12,
	exSoftDeletedVersionNumMsAtPostId: 13,

	currentPostTagIdWithVersionNumAtPostId: 20,
	exPostTagIdWithVersionNumAtPostId: 21,
	currentPostCoreIdWithVersionNumAtPostId: 22,
	exPostCoreIdWithVersionNumAtPostId: 23,

	tagId8AndTxtWithNumAsCount: 30,
	coreId8AndTxtWithNumAsCount: 31,
	reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId: 32,

	spaceId: 40,
	spaceNameTxtId: 41,
	spaceDescriptionTxtId: 42,
	spaceVisibilityBinId: 43,
	newUsersCanReactBinId: 44,
	newUsersCanPostBinId: 45,
	canReactBinIdAtAccountId: 46,
	canPostBinIdAtAccountId: 47,
	promotionToModIdAtAccountId: 48,
	promotionToOwnerIdAtAccountId: 49,

	accountId: 50,
	emailTxtMsAtAccountId: 51,
	pwHashTxtMsAtAccountId: 52,
	nameTxtMsAtAccountId: 53,
	bioTxtMsAtAccountId: 54,
	savedTagsTxtMsAtAccountId: 55,

	clientKeyTxtMsAtAccountId: 60,
	sessionKeyTxtMsAtAccountId: 61,
	createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount: 62,
	signInOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount: 63,
	resetPasswordOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount: 64,

	inviteIdWithNumAsUseCountAndTxtAsSlug: 70,
	validForNumAtInviteId: 71,
	maxUsesNumAtInviteId: 72,
	acceptMsByMsAtInviteId: 73,
	revokeMsByMsAtInviteId: 74,

	postIdAtBumpedRootId: 80,
	lastSpaceViewId: 81,
	lastSpacePostId: 82,
	// TODO: tagIdAtBumpedRootIdWithNumAsMs: 83,
	// lastSpacePostMsAtLastSpaceViewId: 81,
});
