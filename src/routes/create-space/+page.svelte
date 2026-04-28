<script lang="ts">
	import { goto } from '$app/navigation';
	import { getPromptSigningIn, getWhoObj, gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { updateLocalCache } from '$lib/types/local-cache';
	import { accentCodes, permissionCodes, roleCodes } from '$lib/types/spaces';
	import { IconChevronRight } from '@tabler/icons-svelte';
	import PromptSignIn from '../PromptSignIn.svelte';

	let spaceNameTxt = $state('');
	let spaceDescriptionTxt = $state('');
	let spacePinnedQueryTxt = $state('');
	let spaceIsPublicBin = $state(0);
	let newMemberPermissionCodeNum = $state(permissionCodes.reactAndPost);
</script>

{#if !gs.accounts}
	<!--  -->
{:else if getPromptSigningIn()}
	<PromptSignIn />
{:else}
	<div class="p-2 max-w-lg">
		<p class="text-xl font-black">
			{m.createSpace()}
		</p>
		<form
			class="mt-2"
			onsubmit={async (e) => {
				e.preventDefault();
				try {
					let whoObj = await getWhoObj();
					let { ms } = await trpc().createSpace.mutate({
						...whoObj,
						spaceNameTxt,
						spaceDescriptionTxt,
						spacePinnedQueryTxt,
						spaceIsPublicBin,
						newMemberPermissionCodeNum,
					});

					// TODO: cache space stuff locally after creation so it isn't fetched
					// let { callerMs } = whoObj;
					// gs.spaceMsToAccountMsToMembershipMap[res.ms];
					// gs.msToSpaceMap={
					// 	...gs.msToSpaceMap,
					// 	[res.ms]: {

					// 	}
					// }
					// gs.accountMsToSpaceMsToDots = {
					// 	...gs.accountMsToSpaceMsToDots,
					// 	[callerMs]: {
					// 		...gs.accountMsToSpaceMsToDots[callerMs],
					// 		[res.ms]: {
					// 			invites: [],
					// 			endReached: true,
					// 			memberships: [
					// 				{
					// 					accept: {
					// 						ms: res.ms,
					// 						by_ms: callerMs,
					// 					},
					// 					invite: {
					// 						by_ms: 0,
					// 						in_ms: res.ms,
					// 					},
					// 					permission: {
					// 						ms: res.ms,
					// 						by_ms: 0,
					// 						num: permissionCodes.reactAndPost,
					// 					},
					// 				},
					// 			],
					// 		},
					// 	},
					// };
					// gs.accountMsToSpaceMsToCheckedMap = {
					// 	...gs.accountMsToSpaceMsToCheckedMap,
					// 	[callerMs]: {
					// 		...gs.accountMsToSpaceMsToCheckedMap[callerMs],
					// 		[res.ms]: true,
					// 	},
					// };

					updateLocalCache((lc) => {
						lc.accounts[0].joinedSpaceContexts.unshift({
							ms,
							roleCode: { ms, by_ms: 0, num: roleCodes.admin },
							permissionCode: { ms, by_ms: 0, num: permissionCodes.reactAndPost },
							accentCode: { ms, by_ms: 0, num: accentCodes.none },
						});
						return lc;
					});

					goto(`/__${ms}`);
				} catch (error) {
					console.error(error);
					alert(error);
				}
			}}
		>
			<p class="font-bold">{m.name()}</p>
			<input
				bind:value={spaceNameTxt}
				class="w-full px-2 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4"
			/>
			<p class="mt-1 font-bold">{m.description()}</p>
			<textarea
				bind:value={spaceDescriptionTxt}
				class="resize-y w-full px-2 py-0.5 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4 block"
			></textarea>
			<p class="font-bold">{m.pinnedQuery()}</p>
			<input
				bind:value={spacePinnedQueryTxt}
				class="w-full px-2 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4"
			/>
			<div class="mt-2 flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.visibility()}</p>
					<select
						name={m.visibility()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={spaceIsPublicBin}
					>
						<option value={0}>{m.private()}</option>
						<option value={1}>{m.public()}</option>
					</select>
				</div>
				<div class="flex-1">
					<p class="text-sm font-bold">{m.newMembers()}</p>
					<div class="flex">
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 border-l-0 border-bg8 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={newMemberPermissionCodeNum}
						>
							<option value={permissionCodes.viewOnly}>{m.viewOnly()}</option>
							<option value={permissionCodes.reactOnly}>{m.canReact()}</option>
							<option value={permissionCodes.postOnly}>{m.canPost()}</option>
							<option value={permissionCodes.reactAndPost}>{m.canReactAndPost()}</option>
						</select>
					</div>
				</div>
			</div>

			<button
				type="submit"
				class="mt-2 fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
			>
				{m.continue()}
				<IconChevronRight class="h-5" stroke={3} /></button
			>
		</form>
	</div>
{/if}
