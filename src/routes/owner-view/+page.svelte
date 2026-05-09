<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { promptSum } from '$lib/dom';
	import {
		getCallerIsOwner,
		getWhoObj,
		gs,
		mergeMsToAccountNameTxtMap,
		mergeMsToSpaceNameTxtMap,
		msToAccountNameTxt,
		msToSpaceNameTxt,
		toggleAccountBan,
	} from '$lib/global-state.svelte';
	import {
		alertError,
		atDomainRegex,
		emailRegex,
		ownerViewItemsPerLoad,
		rulesAllowEmail,
		setSearchParams,
	} from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import {
		IconBan,
		IconDeviceFloppy,
		IconMail,
		IconMessage,
		IconSquares,
		IconUserPlus,
		IconUsers,
		IconX,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import AccountIcon from '../AccountIcon.svelte';
	import PostFeed from '../PostFeed.svelte';
	import SpaceIcon from '../SpaceIcon.svelte';

	let editing_signedInEmailRulesTxt = $state(false);
	let draft_signedInEmailRulesTxt = $state(gs.ownerView.signedInEmailRulesTxt || '');
	let callerMs = $derived(gs.accounts?.[0].ms);
	let callerIsOwner = $derived(getCallerIsOwner());
	$effect(() => {
		if (gs.accounts && !callerIsOwner) goto('/');
	});

	let makeParams = (newView: 'posts' | 'accounts' | 'spaces') => {
		return setSearchParams({
			...{
				posts: null,
				accounts: null,
				spaces: null,
			},
			...(newView === 'posts'
				? {}
				: newView === 'accounts'
					? { accounts: undefined }
					: { spaces: undefined }),
		});
	};

	let view = $derived<'posts' | 'accounts' | 'spaces'>(
		page.url.searchParams.get('accounts') !== null
			? 'accounts'
			: page.url.searchParams.get('spaces') !== null
				? 'spaces'
				: 'posts',
	);
	let error = $derived(view === 'accounts' ? gs.ownerView.accountsError : gs.ownerView.spacesError);

	// gs.ownerView.accountMss
	// gs.ownerView.accountEndReached
	// gs.ownerView.spacesMss
	// gs.ownerView.spacesEndReached

	let loadMoreAccounts = async (e: InfiniteEvent) => {
		if (gs.ownerView.accountsEndReached) {
			gs.ownerView.accountMss?.length && e.detail.loaded();
			return e.detail.complete();
		}
		let msBefore = gs.ownerView.accountMss?.slice(-1)[0];
		let res = await trpc().getOwnerViewAccounts.query({
			...(await getWhoObj()),
			msBefore,
		});
		res.accounts.length && e.detail.loaded();
		let endReached = res.accounts.length < ownerViewItemsPerLoad;
		endReached && e.detail.complete();
		draft_signedInEmailRulesTxt = res.signedInEmailRulesTxt;
		gs.ownerView = {
			...gs.ownerView,
			signedInEmailRulesTxt: res.signedInEmailRulesTxt,
			accountsEndReached: endReached,
			accountMss: [
				...(gs.ownerView.accountMss || []),
				...res.accounts.map((a) => {
					mergeMsToAccountNameTxtMap({ [a.ms]: a.nameTxt });
					gs.msToProfileMap[a.ms]!.banned = a.banned;
					gs.msToProfileMap[a.ms]!.email = { txt: a.emailTxt };
					return a.ms;
				}),
			],
		};
	};

	let loadMoreSpaces = async (e: InfiniteEvent) => {
		if (gs.ownerView.spacesEndReached) {
			gs.ownerView.spaceMss?.length && e.detail.loaded();
			return e.detail.complete();
		}
		let msBefore = gs.ownerView.spaceMss?.slice(-1)[0];
		let res = await trpc().getOwnerViewSpaces.query({
			...(await getWhoObj()),
			msBefore,
		});
		res.spaces.length && e.detail.loaded();
		let endReached = res.spaces.length < ownerViewItemsPerLoad;
		endReached && e.detail.complete();
		mergeMsToAccountNameTxtMap(res.msToAccountNameTxtMap);
		gs.ownerView = {
			...gs.ownerView,
			spacesEndReached: endReached,
			msToSpaceAdminMssMap: {
				...gs.ownerView.msToSpaceAdminMssMap,
				...res.msToSpaceAdminMssMap,
			},
			spaceMss: [
				...(gs.ownerView.spaceMss || []),
				...res.spaces.map((s) => {
					mergeMsToSpaceNameTxtMap({ [s.ms]: s.nameTxt });
					return s.ms;
				}),
			],
		};
	};

	let accounts = $derived(
		(gs.ownerView.accountMss || []).map((accountMs) => gs.msToProfileMap[accountMs]!),
	);
</script>

{#if !gs.accounts}
	<!--  -->
{:else}
	<div class="flex w-full text-fg2 overflow-scroll h-8">
		<a
			href={makeParams('posts')}
			class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'posts' ? 'text-fg1' : ''}`}
		>
			<IconMessage stroke={2.5} class="h-4" />{m.posts()}
		</a>
		<a
			href={makeParams('accounts')}
			class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'accounts' ? 'text-fg1' : ''}`}
		>
			<IconUsers stroke={2.5} class="h-4" />{m.accounts()}
		</a>
		<a
			href={makeParams('spaces')}
			class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${view === 'spaces' ? 'text-fg1' : ''}`}
		>
			<IconSquares stroke={2.5} class="h-4" />{m.spaces()}
		</a>
	</div>
	{#if view === 'posts'}
		<PostFeed />
	{:else}
		<div class="w-full max-w-2xl">
			{#if view === 'accounts'}
				{#if editing_signedInEmailRulesTxt}
					<div class="max-w-lg px-2">
						<div class="fx font-bold">
							<p class="flex-1">{m.signedInEmailRules()}</p>
							<div class="flex h-8">
								<button
									class="w-8 xy hover:bg-bg3 text-fg2 hover:text-fg1"
									onclick={() => {
										draft_signedInEmailRulesTxt = gs.ownerView.signedInEmailRulesTxt || '';
										editing_signedInEmailRulesTxt = false;
									}}
								>
									<IconX class="w-5" />
								</button>
								<button
									class="xy pl-0.5 pr-1 border-b-2 border-hl1 hover:border-hl2 bg-bg2 hover:bg-bg4 hover:text-fg3"
									onclick={async () => {
										let signedInEmailRules = [
											...new Set(
												draft_signedInEmailRulesTxt
													.trim()
													.split('\n')
													.map((p) => p.trim())
													.filter((p) => p),
											),
										];
										if (
											signedInEmailRules.some((p) => {
												if (!atDomainRegex.test(p) && !emailRegex.test(p)) {
													alert(m.pDoesNotMatch({ p }));
													return true;
												}
											})
										)
											return;
										if (!rulesAllowEmail(signedInEmailRules, gs.accounts![0].email.txt)) {
											return alert(m.rulesMustAllowCallerEmail());
										}
										if (
											!promptSum((a, b) =>
												m.enterTheSumOfAAndBToSignAllOtherAccountsOutAndAllowANewSetOfEmailsToSignIn(
													{ a, b },
												),
											)
										)
											return;

										try {
											let normalized_signedInEmailRulesTxt = signedInEmailRules.join('\n');
											if (gs.ownerView.signedInEmailRulesTxt !== normalized_signedInEmailRulesTxt) {
												await trpc().setOwnerViewAttributes.mutate({
													...(await getWhoObj()),
													signedInEmailRules,
												});
											}
											editing_signedInEmailRulesTxt = false;
											gs.ownerView.signedInEmailRulesTxt = draft_signedInEmailRulesTxt =
												normalized_signedInEmailRulesTxt;
										} catch (error) {
											alertError(error);
										}
									}}
								>
									<IconDeviceFloppy class="w-5 mr-1" />
									{m.save()}
								</button>
							</div>
						</div>
						<p class="text-fg2">{m.separateFullEmailsOrDomainsWithANewLine()}</p>
						<textarea
							bind:value={draft_signedInEmailRulesTxt}
							maxlength={88888}
							class="h-24 mb-1 resize-y w-full px-2 py-0.5 border-l-0 border-bg8 text-lg bg-bg2 hover:bg-bg4 block"
						></textarea>
					</div>
				{:else if gs.ownerView.signedInEmailRulesTxt !== undefined}
					<button
						onclick={() => (editing_signedInEmailRulesTxt = true)}
						class="w-full max-w-full fx px-2 text-fg2 hover:text-fg1 hover:bg-bg4"
					>
						<IconMail class="shrink-0 h-5 w-5 mr-1" />
						<p class="overflow-scroll">
							{gs.ownerView.signedInEmailRulesTxt || m.anyEmailCanCreateAnAccount()}
						</p>
					</button>
				{/if}
				{#each accounts as account}
					<div class="flex h-8">
						<a
							href={`/_${account.ms}_`}
							class="flex-1 px-2 gap-1 fx hover:text-fg3 hover:bg-bg4 text-nowrap overflow-scroll"
						>
							{#if account.banned}
								<p class="">{m.banned()}</p>
								<p class="text-fg2">{formatMs(account.banned.ms, 'day')}</p>
							{/if}
							<AccountIcon ms={account.ms} class="shrink-0 h-5 w-5" />
							<p class="">{msToAccountNameTxt(account.ms)}</p>
							<p class="text-fg2">{account.ms}</p>
							<p class="">{formatMs(account.ms, 'min')}</p>
						</a>
						<a
							target="_blank"
							href={`mailto:${account.email!.txt}`}
							class="px-2 fx hover:text-fg3 hover:bg-bg4"
						>
							{account.email!.txt}
						</a>
						{#if account.ms !== callerMs}
							<button
								onclick={() => toggleAccountBan(account.ms)}
								class="h-8 w-8 xy text-fg2 hover:bg-bg4 hover:text-fg1"
							>
								{#if account.banned}
									<IconUserPlus class="h-5 w-5" />
								{:else}
									<IconBan class="h-5 w-5" />
								{/if}
							</button>
						{/if}
					</div>
				{/each}
			{:else}
				{#each gs.ownerView.spaceMss || [] as spaceMs}
					<div class="flex-1 flex h-8 text-nowrap overflow-scroll">
						<a href={`/__${spaceMs}`} class="flex-1 px-2 gap-1 fx hover:text-fg3 hover:bg-bg4">
							<SpaceIcon ms={spaceMs} class="shrink-0 h-5 w-5" />
							<p class="">{msToSpaceNameTxt(spaceMs)}</p>
							<p class="text-fg2">{spaceMs}</p>
							<p class="">{formatMs(spaceMs, 'min')}</p>
						</a>
						{#each gs.ownerView.msToSpaceAdminMssMap?.[spaceMs] || [] as adminMs}
							<a href={`/_${adminMs}_`} class="fx px-2 hover:text-fg3 hover:bg-bg4">
								<AccountIcon ms={adminMs} class="shrink-0 h-5 w-5" />
								{msToAccountNameTxt(adminMs)}
							</a>
						{/each}
					</div>
				{/each}
			{/if}
			<InfiniteLoading
				identifier={view}
				spinner="spiral"
				on:infinite={view === 'accounts' ? loadMoreAccounts : loadMoreSpaces}
			>
				<p slot="error" class="m-2 text-lg text-fg2">{error}</p>
				<div slot="noResults" class="h-[calc(100vh-36px)] xs:h-screen">
					<p class="m-2 text-lg text-fg2">{m.theEnd()}</p>
				</div>
				<div slot="noMore" class="h-[calc(100vh-36px)] xs:h-screen">
					<p class="m-2 text-lg text-fg2">{m.theEnd()}</p>
				</div>
			</InfiniteLoading>
		</div>
	{/if}
{/if}
