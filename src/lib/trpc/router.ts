import { scrape } from '$lib/dom';
import { m } from '$lib/paraglide/messages';
import { _getCallerContext } from '$lib/server/_getCallerContext';
import { _getPublicProfile } from '$lib/server/_getPublicProfile';
import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { GetCallerContextGetArgSchema, passwordRegexStr } from '$lib/types/accounts';
import { _changeMyAccountAttributes } from '$lib/types/accounts/_changeMyAccountAttributes';
import { _changeSpaceAttributes } from '$lib/types/accounts/_changeSpaceAttributes';
import { _createAccount } from '$lib/types/accounts/_createAccount';
import { _resetPasswordSignedIn } from '$lib/types/accounts/_resetPasswordSignedIn';
import { _signIn } from '$lib/types/accounts/_signIn';
import { _signOut } from '$lib/types/accounts/_signOut';
import { _updateSavedTags } from '$lib/types/accounts/_updateSavedTags';
import { _checkOtp } from '$lib/types/otp/_checkOtp';
import { _sendOtp } from '$lib/types/otp/_sendOtp';
import {
	GranularNumPropSchema,
	GranularTxtPropSchema,
	WhoObjSchema,
	WhoWhereObjSchema,
} from '$lib/types/parts';
import { FullIdObjSchema, IdObjSchema } from '$lib/types/parts/partIds';
import { PostSchema } from '$lib/types/posts';
import { _addPost } from '$lib/types/posts/addPost';
import { _deletePost } from '$lib/types/posts/deletePost';
import { _editPost } from '$lib/types/posts/editPost';
import { _getPostFeed, GetPostFeedArgSchema } from '$lib/types/posts/getPostFeed';
import { _getPostHistory } from '$lib/types/posts/getPostHistory';
import { ReactionSchema } from '$lib/types/reactions';
import { _addReaction } from '$lib/types/reactions/addReaction';
import { _getReactionHistory } from '$lib/types/reactions/getReactionHistory';
import { _removeReaction } from '$lib/types/reactions/removeReaction';
import { permissionCodes, roleCodes } from '$lib/types/spaces';
import { _checkInvite } from '$lib/types/spaces/_checkInvite';
import { _createInviteLink } from '$lib/types/spaces/_createInviteLink';
import { _createSpace } from '$lib/types/spaces/_createSpace';
import { _getSpaceDots } from '$lib/types/spaces/_getSpaceDots';
import { _revokeInviteLink } from '$lib/types/spaces/_revokeInviteLink';
import { _getSpaceTags } from '$lib/types/spaces/getSpaceTags';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import {
	emailLimiter,
	feedLimiter,
	generalLimiter,
	makeLimiter,
	postLimiter,
	reactionLimiter,
	signInLimiter,
} from '../server/rateLimiters';

let pinSchema = z.string().length(8);
let passwordSchema = z.string().regex(new RegExp(passwordRegexStr));
let normalizingNameSchema = z
	.string()
	.max(88)
	.transform((s) => s.trim());
let normalizingBioOrDescriptionSchema = z
	.string()
	.max(888)
	.transform((s) => s.trim());
let emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
let normalizingEmailSchema = z
	.string()
	.min(6)
	.max(254)
	.transform((s) => s.trim().toLowerCase())
	.refine((s) => emailRegex.test(s), { message: 'invalid email' });

let t = initTRPC.context<Context>().create();

let generalProcedure = t.procedure.use(async ({ ctx, next }) => {
	await generalLimiter.ping(ctx);
	return next();
});

let whoProcedure = generalProcedure.input(WhoObjSchema);

let whoWhereProcedure = generalProcedure.input(
	WhoWhereObjSchema.refine(
		(b) => b.spaceMs > 0, //
		{ message: 'spaceMs must be gt0' },
	),
);

let test = 0;
let testLimiter = makeLimiter(3, 1 / 6);
export let router = t.router({
	test: generalProcedure.query(async ({ ctx }) => {
		await testLimiter.ping(ctx);
		test++;
		return { test };
	}),
	scrape: generalProcedure //
		.input(z.object({ url: z.string().url() }))
		.query(async ({ input }) => {
			// TODO: paste a url in mindapp url as a search or maybe under /parse/[text].
			// fetch the page and scrape it as if using the extension shortcut.
			// Useful for environments where the Mindapp browser extension can't be used
			try {
				// TODO: DOMParser not available server side
				return scrape(input.url, await (await fetch(input.url)).text());
			} catch (error) {
				throw new Error(`Fetch error: ${error}`);
			}
		}),
	sendOtp: generalProcedure
		.input(
			z.object({
				email: normalizingEmailSchema,
				will: z.object({
					createAccount: z.boolean().optional(),
					signIn: z.boolean().optional(),
					resetPassword: z.boolean().optional(),
				}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await emailLimiter.ping(ctx);
			return _sendOtp(input);
		}),
	checkOtp: generalProcedure
		.input(
			z.object({
				otpMs: z.number(),
				pin: pinSchema,
				email: normalizingEmailSchema,
			}),
		)
		.mutation(({ input }) => _checkOtp(input)),
	createAccount: generalProcedure
		.input(
			z.object({
				name: normalizingNameSchema,
				otpMs: z.number(),
				pin: pinSchema,
				email: normalizingEmailSchema,
				password: passwordSchema,
			}),
		)
		.mutation(({ ctx, input }) => _createAccount(ctx, input)),
	signIn: generalProcedure
		.input(
			z.object({
				otpMs: z.number().optional(),
				pin: pinSchema.optional(),
				email: normalizingEmailSchema,
				password: passwordSchema,
				resetPassword: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await signInLimiter.ping(ctx);
			return _signIn(ctx, input);
		}),
	getPublicProfile: whoProcedure
		.input(
			z.object({
				profileMs: z.number(),
				possibleMutualSpaceMss: z.array(z.number()).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (input.callerMs && input.possibleMutualSpaceMss?.length) {
				let c = await _getCallerContext(ctx, input, { signedIn: true });
				throwIf(!c.signedIn);
			}
			return _getPublicProfile(input);
		}),
	getCallerContext: whoProcedure
		.input(
			z.object({
				spaceMs: z.number().optional(), // this is the only api function that can be called when lastSeenInMs = 0
				get: GetCallerContextGetArgSchema,
			}),
		)
		.query(async ({ ctx, input }) => _getCallerContext(ctx, input, input.get)),
	resetPasswordSignedIn: whoProcedure
		.input(
			z.object({
				oldPassword: passwordSchema,
				newPassword: passwordSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error(m.placeholderError());
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _resetPasswordSignedIn(input);
		}),
	signOut: whoProcedure
		.input(z.object({ everywhere: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _signOut(ctx, input);
		}),
	updateSavedTags: whoProcedure
		.input(
			z.object({
				tags: z.array(z.string()),
				remove: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _updateSavedTags(input);
		}),
	checkInvite: whoProcedure
		.input(
			z.object({
				inviteSlug: z.string(),
				useIfValid: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.useIfValid) {
				let c = await _getCallerContext(ctx, input, {
					signedIn: input.useIfValid,
					permissionCode: input.useIfValid,
				});
				if (c.permissionCode) throw new Error(m.alreadyJoinedThisSpace());
				throwIf(!c.signedIn && input.useIfValid);
			}
			return _checkInvite(input);
		}),
	changeMyAccountAttributes: whoProcedure
		.input(
			z.object({
				nameTxt: normalizingNameSchema.optional(),
				bioTxt: normalizingBioOrDescriptionSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(input.nameTxt === undefined && input.bioTxt === undefined);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _changeMyAccountAttributes(input);
		}),
	createSpace: whoProcedure
		.input(
			z.object({
				spaceNameTxt: normalizingNameSchema,
				spaceDescriptionTxt: normalizingBioOrDescriptionSchema,
				spacePinnedQueryTxt: normalizingBioOrDescriptionSchema,
				spaceIsPublicBin: z.number().gte(0).lte(1),
				newMemberPermissionCodeNum: z
					.number()
					.gte(permissionCodes.viewOnly)
					.lte(permissionCodes.reactAndPost),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _createSpace(input);
		}),
	changeSpaceAttributes: whoWhereProcedure
		.input(
			z.object({
				nameTxt: normalizingNameSchema.optional(),
				descriptionTxt: normalizingBioOrDescriptionSchema.optional(),
				pinnedQueryTxt: normalizingBioOrDescriptionSchema.optional(),
				isPublicNum: z.number().gte(0).lte(1).optional(),
				newMemberPermissionCodeNum: z
					.number()
					.gte(permissionCodes.viewOnly)
					.lte(permissionCodes.reactAndPost)
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(
				input.nameTxt === undefined &&
					input.descriptionTxt === undefined &&
					input.pinnedQueryTxt === undefined &&
					input.isPublicNum === undefined &&
					input.newMemberPermissionCodeNum === undefined,
			);
			let c = await _getCallerContext(ctx, input, { signedIn: true, roleCode: true });
			throwIf(!c.signedIn || c.roleCode?.num !== roleCodes.owner);
			return _changeSpaceAttributes(input);
		}),
	addPost: whoWhereProcedure
		.input(z.object({ post: PostSchema })) //
		.mutation(async ({ input, ctx }) => {
			await postLimiter.ping(ctx);
			let { post } = input;
			// TODO: allow non zero ms if the caller is an owner of the space (useful for importing old posts)
			if (post.ms) throw new Error('post ms must be 0');
			if (!post.by_ms || post.by_ms !== input.callerMs) throw new Error('Invalid by_ms');
			if (!post.in_ms || post.in_ms !== input.spaceMs) throw new Error('Invalid in_ms');
			if (!post.history || Object.keys(post.history).length !== 1 || !post.history['1'])
				throw new Error('History must have only version 1');
			if (post.history['1'].ms) throw new Error('version 1 ms must be 0');
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				permissionCode: true,
			});
			throwIf(
				!c.signedIn ||
					(c.permissionCode?.num !== permissionCodes.postOnly &&
						c.permissionCode?.num !== permissionCodes.reactAndPost),
			);
			return _addPost(tdb, post);
		}),
	editPost: whoWhereProcedure //
		.input(z.object({ post: PostSchema }))
		.mutation(async ({ input, ctx }) => {
			await postLimiter.ping(ctx);
			let { post } = input;
			if (!post.by_ms || post.by_ms !== input.callerMs) throw new Error('Invalid callerMs');
			if (!post.in_ms || post.in_ms !== input.spaceMs) throw new Error('Invalid callerMs');
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				permissionCode: true,
			});
			throwIf(
				!c.signedIn ||
					(c.permissionCode?.num !== permissionCodes.postOnly &&
						c.permissionCode?.num !== permissionCodes.reactAndPost),
			);
			return _editPost(tdb, post);
		}),
	deletePost: whoWhereProcedure
		.input(
			z.object({
				fullPostIdObj: FullIdObjSchema,
				version: z.number().gte(0).nullable(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await postLimiter.ping(ctx);
			let { fullPostIdObj, callerMs, spaceMs } = input;
			if (!callerMs || fullPostIdObj.by_ms !== callerMs) throw new Error('Invalid callerMs');
			if (!spaceMs || fullPostIdObj.in_ms !== spaceMs) throw new Error('Invalid spaceMs');
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _deletePost(tdb, fullPostIdObj, input.version);
		}),
	addReaction: whoWhereProcedure //
		.input(z.object({ rxn: ReactionSchema }))
		.mutation(async ({ input, ctx }) => {
			await reactionLimiter.ping(ctx);
			let { rxn } = input;
			if (!rxn.in_ms || rxn.by_ms !== input.callerMs) throw new Error('Invalid callerMs');
			if (!rxn.by_ms || rxn.in_ms !== input.spaceMs) throw new Error('Invalid spaceMs');
			if (rxn.ms) throw new Error('rxn ms must be 0');
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				permissionCode: true,
			});
			throwIf(
				!c.signedIn ||
					(c.permissionCode?.num !== permissionCodes.reactOnly &&
						c.permissionCode?.num !== permissionCodes.reactAndPost),
			);
			return _addReaction(tdb, rxn);
		}),
	removeReaction: whoWhereProcedure //
		.input(z.object({ rxn: ReactionSchema }))
		.mutation(async ({ input, ctx }) => {
			await reactionLimiter.ping(ctx);
			let { rxn } = input;
			if (!rxn.in_ms || rxn.by_ms !== input.callerMs) throw new Error('Invalid callerMs');
			if (!rxn.by_ms || rxn.in_ms !== input.spaceMs) throw new Error('Invalid callerMs');
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _removeReaction(tdb, rxn);
		}),
	getSpaceDots: whoWhereProcedure
		.input(
			z.object({
				msBefore: z.number().optional(),
				lastMemberListRoleCodeNum: z.number().optional(),
				lastAcceptByMssWithSameRoleMs: z.array(z.number()).optional(),
				memberCount: z.number().optional(),
				description: GranularTxtPropSchema.optional(),
				newMemberPermissionCode: GranularNumPropSchema.optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			let c = await _getCallerContext(ctx, input, {
				isPublic: true,
				signedIn: true,
				roleCode: true,
			});
			throwIf(!c.isPublic?.num && c.roleCode === undefined);
			return _getSpaceDots(tdb, { ...input, roleCode: c.roleCode });
		}),
	createInviteLink: whoWhereProcedure
		.input(
			z.object({
				validFor: z.number().min(0).max(week),
				maxUses: z.number().min(0).max(99999999),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: true,
			});
			throwIf(
				!c.signedIn || (c.roleCode?.num !== roleCodes.mod && c.roleCode?.num !== roleCodes.owner),
			);
			return _createInviteLink(input);
		}),
	revokeInviteLink: whoWhereProcedure
		.input(
			z.object({
				inviteMs: z.number(),
				slugEnd: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: true,
			});
			throwIf(!c.signedIn || !c.roleCode);
			return _revokeInviteLink(input);
		}),
	getPostHistory: whoWhereProcedure
		.input(
			z.object({
				postIdObj: IdObjSchema,
				version: z.number().gt(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			if (input.postIdObj.in_ms !== input.spaceMs) throw new Error('Invalid spaceMs');
			let c = await _getCallerContext(ctx, input, {
				permissionCode: true,
				signedIn: true,
				isPublic: true,
			});
			throwIf(!c.signedIn || (!c.isPublic && c.permissionCode === undefined));
			return _getPostHistory(tdb, input.postIdObj, input.version);
		}),
	getReactionHistory: whoWhereProcedure
		.input(
			z.object({
				postIdObj: IdObjSchema,
				msBefore: z.number(),
				rxnIdObjsExclude: z.array(IdObjSchema),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			if (input.postIdObj.in_ms !== input.spaceMs) throw new Error('Invalid spaceMs');
			let c = await _getCallerContext(ctx, input, {
				permissionCode: true,
				signedIn: true,
				isPublic: true,
			});
			throwIf(!c.signedIn || (!c.isPublic && c.permissionCode === undefined));
			return _getReactionHistory(tdb, input);
		}),
	getPostFeed: whoWhereProcedure //
		.input(GetPostFeedArgSchema)
		.query(async ({ input, ctx }) => {
			await feedLimiter.ping(ctx);
			let c = await _getCallerContext(ctx, input, {
				permissionCode: true,
				signedIn: true,
				// permissionCode: true,
				isPublic: true,
			});
			throwIf(!c.isPublic && (!c.signedIn || c.permissionCode === undefined));
			return _getPostFeed(tdb, input);
		}),
	getSpaceTags: whoWhereProcedure
		.input(
			z.object({
				fromCount: z.number(),
				excludeTags: z.array(z.string()),
			}),
		)
		.query(async ({ input, ctx }) => {
			let c = await _getCallerContext(ctx, input, {
				permissionCode: true,
				signedIn: true,
				isPublic: true,
			});
			throwIf(!c.isPublic && (!c.signedIn || c.permissionCode === undefined));
			return _getSpaceTags(tdb, input);
		}),
});

export type Router = typeof router;
