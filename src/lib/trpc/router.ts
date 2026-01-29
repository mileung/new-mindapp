import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { passwordRegexStr } from '$lib/types/accounts';
import { _changeMyAccountNameOrBio } from '$lib/types/accounts/_changeMyAccountNameOrBio';
import { _changeSpaceName } from '$lib/types/accounts/_changeSpaceName';
import { _createAccount } from '$lib/types/accounts/_createAccount';
import { _refreshSignedInAccounts } from '$lib/types/accounts/_refreshSignedInAccounts';
import { _resetPassword } from '$lib/types/accounts/_resetPassword';
import { _signIn } from '$lib/types/accounts/_signIn';
import { _signOut } from '$lib/types/accounts/_signOut';
import { _updateSavedTags } from '$lib/types/accounts/_updateSavedTags';
import { _checkOtp } from '$lib/types/otp/_checkOtp';
import { _sendOtp } from '$lib/types/otp/_sendOtp';
import { GranularTxtPropSchema, WhoObjSchema, WhoWhereObjSchema } from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { FullIdObjSchema, IdObjSchema } from '$lib/types/parts/partIds';
import { PostSchema } from '$lib/types/posts';
import { _addPost } from '$lib/types/posts/addPost';
import { _deletePost } from '$lib/types/posts/deletePost';
import { _editPost } from '$lib/types/posts/editPost';
import { _getPostFeed, GetPostFeedSchema } from '$lib/types/posts/getPostFeed';
import { _getPostHistory } from '$lib/types/posts/getPostHistory';
import { ReactionSchema } from '$lib/types/reactions';
import { _addReaction } from '$lib/types/reactions/addReaction';
import { _getReactionHistory } from '$lib/types/reactions/getReactionHistory';
import { _removeReaction } from '$lib/types/reactions/removeReaction';
import { _checkInvite } from '$lib/types/spaces/_checkInvite';
import { _createInvite } from '$lib/types/spaces/_createInvite';
import { _getMySpaceMembership } from '$lib/types/spaces/_getMySpaceMembership';
import { _getSpaceMembers } from '$lib/types/spaces/_getSpaceMembers';
import { _getSpaceTags } from '$lib/types/spaces/getSpaceTags';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { _getCallerPermissions } from '../server/_getCallerPermissions';
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
	refreshSignedInAccounts: generalProcedure
		.input(
			z.object({
				callerAttributes: z
					.object({
						email: GranularTxtPropSchema,
						name: GranularTxtPropSchema,
						bio: GranularTxtPropSchema,
						savedTags: GranularTxtPropSchema,
						spaceMss: GranularTxtPropSchema,
					})
					.optional(),
				accountMss: z
					.array(z.number())
					.min(1)
					.max(88)
					.refine(
						(mss) => mss.every((ms) => ms > 0), //
						{ message: 'account ms must be gt0' },
					),
			}),
		)
		.query(({ ctx, input }) => _refreshSignedInAccounts(ctx, input)),
	sendOtp: generalProcedure
		.input(
			z.object({
				email: normalizingEmailSchema,
				partCode: z
					.literal(pc.createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount)
					.or(z.literal(pc.resetPasswordOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount)),
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
				partCode: z
					.literal(pc.createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount)
					.or(z.literal(pc.signInOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount))
					.or(z.literal(pc.resetPasswordOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount)),
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
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await signInLimiter.ping(ctx);
			return _signIn(ctx, input);
		}),
	resetPassword: whoProcedure
		.input(
			z.object({
				otpMs: z.number(),
				pin: pinSchema,
				email: normalizingEmailSchema,
				password: passwordSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error(m.placeholderError());
			let p = await _getCallerPermissions(ctx, input, { signedIn: true });
			throwIf(!p.signedIn);
			return _resetPassword(input);
		}),
	signOut: whoProcedure
		.input(z.object({ everywhere: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			let p = await _getCallerPermissions(ctx, input, { signedIn: true });
			throwIf(!p.signedIn);
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
			let p = await _getCallerPermissions(ctx, input, { signedIn: true });
			throwIf(!p.signedIn);
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
			let p = await _getCallerPermissions(ctx, input, {
				signedIn: input.useIfValid,
				callerRole: input.useIfValid,
			});
			if (p.callerRole) throw new Error(m.alreadyJoinedThisSpace());
			throwIf(!p.signedIn && input.useIfValid);
			return _checkInvite(input);
		}),
	getMySpaceMembership: whoWhereProcedure.query(async ({ ctx, input }) => {
		let p = await _getCallerPermissions(ctx, input, {
			signedIn: true,
		});
		throwIf(!p.signedIn);
		return _getMySpaceMembership(input);
	}),
	changeMyAccountNameOrBio: whoProcedure
		.input(
			z.object({
				nameTxt: normalizingNameSchema.optional(),
				bioTxt: normalizingBioOrDescriptionSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(input.nameTxt === undefined && input.bioTxt === undefined);
			let p = await _getCallerPermissions(ctx, input, { signedIn: true });
			throwIf(!p.signedIn);
			return _changeMyAccountNameOrBio(input);
		}),
	changeSpaceName: whoWhereProcedure
		.input(z.object({ nameTxt: z.string() }))
		.mutation(async ({ ctx, input }) => {
			let p = await _getCallerPermissions(ctx, input, {
				signedIn: true,
				callerRole: true,
			});
			throwIf(!p.signedIn || p.callerRole !== 'owner');
			return _changeSpaceName(input);
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
			if (post.history['1'].ms) throw new Error('history ms must be 1');
			let p = await _getCallerPermissions(ctx, input, {
				signedIn: true,
				canPost: true,
			});
			throwIf(!p.signedIn || !p.canPost);
			return _addPost(tdb, post);
		}),
	editPost: whoWhereProcedure //
		.input(z.object({ post: PostSchema }))
		.mutation(async ({ input, ctx }) => {
			await postLimiter.ping(ctx);
			let { post } = input;
			if (!post.by_ms || post.by_ms !== input.callerMs) throw new Error('Invalid callerMs');
			if (!post.in_ms || post.in_ms !== input.spaceMs) throw new Error('Invalid callerMs');
			let p = await _getCallerPermissions(ctx, input, {
				signedIn: true,
				canPost: true,
			});
			throwIf(!p.signedIn || !p.canPost);
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
			let p = await _getCallerPermissions(ctx, input, { signedIn: true });
			throwIf(!p.signedIn);
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
			let p = await _getCallerPermissions(ctx, input, {
				signedIn: true,
				canReact: true,
			});
			throwIf(!p.signedIn || !p.canReact);
			return _addReaction(tdb, rxn);
		}),
	removeReaction: whoWhereProcedure //
		.input(z.object({ rxn: ReactionSchema }))
		.mutation(async ({ input, ctx }) => {
			await reactionLimiter.ping(ctx);
			let { rxn } = input;
			if (!rxn.in_ms || rxn.by_ms !== input.callerMs) throw new Error('Invalid callerMs');
			if (!rxn.by_ms || rxn.in_ms !== input.spaceMs) throw new Error('Invalid callerMs');
			let p = await _getCallerPermissions(ctx, input, { signedIn: true });
			throwIf(!p.signedIn);
			return _removeReaction(tdb, rxn);
		}),
	getSpaceMembers: whoWhereProcedure
		.input(z.object({ fromMs: z.number().optional() }))
		.query(async ({ input, ctx }) => {
			// if (!input.callerMs) throw new Error('anon disallowed');
			let p = await _getCallerPermissions(ctx, input, {
				spaceIsPublic: true,
				signedIn: true,
				callerRole: true,
			});
			throwIf(!p.spaceIsPublic && !p.callerRole);
			return _getSpaceMembers(tdb, input);
		}),
	createInvite: whoWhereProcedure
		.input(
			z.object({
				validFor: z.number().min(0).max(week),
				maxUses: z.number().min(0).max(99999999),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let p = await _getCallerPermissions(ctx, input, {
				signedIn: true,
				callerRole: true,
			});
			throwIf(!p.signedIn || (p.callerRole !== 'mod' && p.callerRole !== 'owner'));
			return _createInvite(input);
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
			let p = await _getCallerPermissions(ctx, input, {
				callerRole: true,
				signedIn: true,
				spaceIsPublic: true,
			});
			throwIf(!p.signedIn || (!p.spaceIsPublic && !p.callerRole));
			return _getPostHistory(tdb, input.postIdObj, input.version);
		}),
	getReactionHistory: whoWhereProcedure
		.input(
			z.object({
				postIdObj: IdObjSchema,
				fromMs: z.number(),
				rxnIdObjsExclude: z.array(IdObjSchema),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			if (input.postIdObj.in_ms !== input.spaceMs) throw new Error('Invalid spaceMs');
			let p = await _getCallerPermissions(ctx, input, {
				callerRole: true,
				signedIn: true,
				spaceIsPublic: true,
			});
			throwIf(!p.signedIn || (!p.spaceIsPublic && !p.callerRole));
			return _getReactionHistory(tdb, input);
		}),
	getPostFeed: whoWhereProcedure //
		.input(GetPostFeedSchema)
		.query(async ({ input, ctx }) => {
			await feedLimiter.ping(ctx);
			if (!input.inMssInclude.length) throw new Error('inMssInclude.length must be gt0');
			let p = await _getCallerPermissions(ctx, input, {
				callerRole: true,
				signedIn: true,
				spaceIsPublic: true,
			});
			throwIf(input.callerMs && !p.signedIn);
			throwIf(!p.spaceIsPublic && (!p.signedIn || !p.callerRole));
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
			let p = await _getCallerPermissions(ctx, input, {
				callerRole: true,
				signedIn: true,
				spaceIsPublic: true,
			});
			throwIf(!p.spaceIsPublic && (!p.signedIn || !p.callerRole));
			return _getSpaceTags(tdb, input);
		}),
});

export type Router = typeof router;
