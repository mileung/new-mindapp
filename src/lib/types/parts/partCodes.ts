type UniqueValues<T extends Record<string, number>> = {
	[K in keyof T]: T[K] extends T[Exclude<keyof T, K>] ? never : T[K];
};
let uniqueMapVals = <const T extends Record<string, number>>(dict: UniqueValues<T>): T => dict;

export let pc = uniqueMapVals({
	postIdWithNumAsLastVersionAtParentPostId: 0,
	childPostIdWithNumAsDepthAtRootId: 1,
	postIdAtCitedPostId: 2,
	reactionIdWithEmojiTxtAtPostId: 3,

	currentVersionNumAndMsAtPostId: 10,
	currentSoftDeletedVersionNumAndMsAtPostId: 11,
	exVersionNumAndMsAtPostId: 12,
	exSoftDeletedVersionNumAndMsAtPostId: 13,

	currentPostTagIdWithNumAsVersionAtPostId: 20,
	currentPostCoreIdWithNumAsVersionAtPostId: 21,
	exPostTagIdWithNumAsVersionAtPostId: 22,
	exPostCoreIdWithNumAsVersionAtPostId: 23,

	tagIdAndTxtWithNumAsCount: 30,
	coreIdAndTxtWithNumAsCount: 31,
	reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId: 32,

	spaceId: 40,
	txtAsSpaceNameToSpaceId: 41,
	spaceInviteWithAcceptanceMsAsNumAtAccountId: 42,
	lastSpaceViewMsAtAccountId: 43,
	spaceRoleNumAsIdAtAccountId: 44,

	accountId: 50,
	msAndTxtAsNameAtAccountId: 51,
	txtAsAccountEmailAtAccountId: 52,
	txtAsAccountPwHashAtAccountId: 53,

	// accountIdInContactsSinceMsAtAccountId: 54,
	// accountHandleAtAccountId: 51,
	// contactNote: 56,

	msAndTxtAsClientIdAtAccountId: 60,
	createAccountOtpWithTxtAsEmailColonPinAndNumAsStrikeCount: 61,
	signInOtpWithTxtAsEmailColonPinAndNumAsStrikeCount: 62,
	resetPasswordOtpWithTxtAsEmailColonPinAndNumAsStrikeCount: 63,

	msAndTxtAsSessionIdAtAccountId: 70,
	// sessionIdWithTxtAsKeyAndNumAsExpiryAtAccountId: 70,

	postIdAtBumpedRootId: 80,
	reactionIdAtBumpedRootId: 81,
});
