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

	currentVersionNumAndMsAtPostId: 10,
	exVersionNumAndMsAtPostId: 11,
	currentSoftDeletedVersionNumAndMsAtPostId: 12,
	exSoftDeletedVersionNumAndMsAtPostId: 13,

	currentPostTagIdWithNumAsVersionAtPostId: 20,
	exPostTagIdWithNumAsVersionAtPostId: 21,
	currentPostCoreIdWithNumAsVersionAtPostId: 22,
	exPostCoreIdWithNumAsVersionAtPostId: 23,

	tagId8AndTxtWithNumAsCount: 30,
	coreId8AndTxtWithNumAsCount: 31,
	reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId: 32,

	spaceId: 40,
	spaceVisibilityIdNum: 41,
	newUsersCanPostIdNum: 42,
	spaceNameIdTxt: 43,
	spaceDescriptionIdTxt: 44,
	joinMsByMsAtInviteId: 45,
	canWriteIdNumAtAccountId: 46,
	promotionToModIdAtAccountId: 47,
	promotionToOwnerIdAtAccountId: 48,

	accountId: 50,
	emailMsTxtAtAccountId: 51,
	pwHashMsTxtAtAccountId: 52,
	nameMsTxtAtAccountId: 53,
	bioMsTxtAtAccountId: 54,
	savedTagsMsTxtAtAccountId: 55,

	clientKeyTxtMsAtAccountId: 60,
	sessionKeyTxtMsAtAccountId: 61,
	createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount: 62,
	signInOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount: 63,
	resetPasswordOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount: 64,

	inviteMsByMsWithNumAsUseCountAndTxtAsSlugAtSpaceId: 70,
	validForNumAtInviteId: 71,
	maxUsesNumAtInviteId: 72,
	revokeMsByMsAtInviteId: 74,

	postIdAtBumpedRootId: 80,
	LastSpaceViewId: 81,
	lastSpacePostId: 82,
	// lastSpacePostMsAtLastSpaceViewId: 81,
});

// spaceRoleId8AndTxtWithNumAsCount: 33,
// modIdAtPromoterId:22551225,
// ownerIdAtPromoterId:225512255,
// currentSpaceRoleIdAtAccountId: 44,
// exSpaceRoleIdAtAccountId: 45,
// joinMsByMsAtInviteId: 46,
// exitIdAtAccountId: 47,

// memberIdAtDemoterId:2255270,
// currentMemberIdAtInviteId:2255122552,
// currentModIdAtInviteId:22551225,
// currentOwnerIdAtInviteId:225512255,
// exMemberIdAtInviteId:22551,

// promoteToModIdAtAccountId:1222,
// promoteToCoOwnerIdAtAccountId:122,
// demoteToModIdAtAccountId:1252,
// demoteToMemberIdAtAccountId:12252,

// accountIdWithNumAsLastSeenMsAtSpaceId: 43,
// exSpaceRoleIdAtAccountId: 45,
// spaceInviteWithAcceptanceMsAsNumAtAccountId: 42,

// badgeIdAtAccountId
// spaceIdAtAccountId

// useMsByMsAtInviteId:76,
// exitMsByMsAtInviteId:77,

// acceptMsByMsAtInviteId: 73,
// revokeMsByMsAtInviteId: 74,

// kickIdAtAccountId:59,
// muteIdAtAccountId:58,
// banMsByMsAtInviteId:,
// canReadAndWrite
// canOnlyRead
