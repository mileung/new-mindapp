<script lang="ts">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { passwordRegexStr, type MyAccount } from '$lib/types/accounts';
	import { updateLocalCache } from '$lib/types/local-cache';
	import { getWhoObj } from '$lib/types/parts';
	import { pc } from '$lib/types/parts/partCodes';
	import { usePendingInvite } from '$lib/types/spaces';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let p: {
		signingIn?: boolean;
		creatingAccount?: boolean;
		resettingPassword?: boolean;
	} = $props();
	let resettingPassword = $state(false);
	let otpMs = $state(0);
	let name = $state('');
	let pin = $state('');
	let email = $state('');
	let password = $state('');
	let reenteredPw = $state('');
	let showingPw = $state(false);
	let escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	let escapedPw = $derived(escapeRegExp(password));
	let pwIptProps = $derived({
		type: showingPw ? '' : 'password',
		minlength: 8,
		maxlength: 64,
		class: 'font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1 border-l-0 border-bg8',
	});

	$effect(() => {
		email = page.state.email || '';
	});

	let onAccountAuth = (account?: MyAccount) => {
		if (account) {
			updateLocalCache((lc) => ({
				...lc,
				accounts: [
					{ ...account, signedIn: true },
					...lc.accounts.filter((a) => a.ms !== account.ms),
				],
			}));
			gs.urlToFeedMap = {};
			gs.accountMsToSpaceMsToCheckedMap = {
				...gs.accountMsToSpaceMsToCheckedMap,
				[account.ms]: {},
			};
			gs.pendingInvite //
				? usePendingInvite()
				: goto(`/__${gs.urlInMs}`);
		}
	};
</script>

{#snippet pwInputs()}
	<div class="mt-2 flex justify-between items-end">
		<p class="font-bold">{m.password()}</p>
		{#if p.signingIn}
			<a href="/reset-password" class="text-hl1 hover:text-hl2">
				{m.forgotPassword()}
			</a>
		{:else}
			<button
				type="button"
				class="text-fg2 hover:text-fg1"
				onclick={(e) => {
					e.preventDefault();
					showingPw = !showingPw;
				}}
			>
				{showingPw ? m.hide() : m.show()}
			</button>
		{/if}
	</div>
	<input
		required
		bind:value={password}
		autocomplete={p.signingIn ? 'current-password' : 'new-password'}
		{...pwIptProps}
		pattern={passwordRegexStr}
		title={m.charactersIncludingOnesFromAZAZ_0_9()}
	/>
	{#if !p.signingIn}
		<p class="mt-2 font-bold">{m.reenterPassword()}</p>
		<input
			required
			bind:value={reenteredPw}
			autocomplete="new-password"
			{...pwIptProps}
			pattern={escapedPw}
			title={m.passwordsMustMatch()}
		/>
	{/if}
{/snippet}
{#snippet continueAndChangeEmailBtn()}
	<div class="mt-2 flex items-end w-full justify-between">
		<button
			type="submit"
			class="fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
		>
			{m.continue()}
			<IconChevronRight class="h-5" stroke={3} /></button
		>
		{#if otpMs && p.creatingAccount}
			<button
				class="text-fg2 hover:text-fg1"
				onclick={() => {
					email = '';
					otpMs = 0;
				}}
			>
				{m.changeEmail()}
			</button>
		{/if}
	</div>
{/snippet}

<div class={`xy p-2 ${!gs.pendingInvite ? 'min-h-screen' : 'min-h-[calc(100vh-36px)]'}`}>
	<div class="w-full max-w-sm">
		{#if resettingPassword}
			<p class="text-3xl font-black">{m.resetPassword()}</p>
			<p class="font-bold break-all">{m.forEmail({ e: email })}</p>
			<form
				class="mt-2"
				onsubmit={async (e) => {
					e.preventDefault();
					try {
						let res = await trpc().resetPassword.mutate({
							...(await getWhoObj()),
							otpMs,
							pin,
							email,
							password,
						});
						// TODO: sign in
					} catch (error) {
						console.error(error);
						alert(error);
					}
				}}
			>
				{@render pwInputs()}
				{@render continueAndChangeEmailBtn()}
			</form>
		{:else if otpMs}
			<p class="text-3xl font-black">{m.checkYourInbox()}</p>
			<p class="mt-2 text-lg">{m.enterTheOneTimePinWeSentTo()}</p>
			<p class="font-bold break-all">{email}</p>
			<form
				class="mt-2"
				onsubmit={async (e) => {
					e.preventDefault();
					try {
						let strike: undefined | number;
						let expiredOtp: undefined | true;
						if (p.signingIn || p.creatingAccount) {
							let res = p.signingIn
								? await trpc().signIn.mutate({
										email,
										password,
										otpMs,
										pin,
									})
								: await trpc().createAccount.mutate({
										name,
										email,
										password,
										otpMs,
										pin,
									});
							if (res.fail) return alert(m.anErrorOccurred());
							strike = res.strike;
							expiredOtp = res.expiredOtp;
							onAccountAuth(res.account);
						} else if (p.resettingPassword) {
							let res = await trpc().checkOtp.mutate({
								otpMs,
								pin,
								email,
								partCode: pc.resetPasswordOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount,
							});
							strike = res?.strike;
							expiredOtp = res?.expiredOtp;
							if (!strike && !expiredOtp) resettingPassword = true;
						}
						if (expiredOtp) {
							alert(m.expiredOneTimePin());
							email = pin = '';
						}
						if (strike) {
							if (strike > 2) {
								alert(m.tooManyFailedAttempts());
								email = pin = '';
							} else alert(m.incorrectOneTimePin());
						}
					} catch (error) {
						console.error(error);
						alert(error);
					}
				}}
			>
				<p class="mt-2 font-bold">{m.oneTimePin()}</p>
				<input
					bind:value={pin}
					class="bg-bg4 w-full px-2 h-9 text-lg border-l-0 border-bg8"
					required
					maxlength={8}
					minlength={8}
					inputmode="numeric"
					oninput={(e) => {
						pin = e.currentTarget.value.replace(/[^0-9]/g, '');
						// TODO: prevent the "Please lengthen this text" thing from showing up as the user is trying to correct a submitted invalid input
					}}
				/>
				{@render continueAndChangeEmailBtn()}
			</form>
		{:else}
			<p class="text-3xl font-black">
				{p.resettingPassword //
					? m.resetPassword()
					: p.signingIn
						? m.signIn()
						: m.createAccount()}
			</p>
			<form
				class="mt-2"
				onsubmit={async (e) => {
					e.preventDefault();
					if ((p.creatingAccount || p.signingIn) && gs.accounts!.length >= 88) {
						return alert(m.placeholderError()); // gs.accounts.length must be lte88
					}
					try {
						let normalizedEmail = email.trim().toLowerCase();
						if (p.signingIn) {
							let signedInAccount = gs.accounts?.find(
								(a) => a.signedIn && a.email.txt === normalizedEmail,
							);
							if (signedInAccount) {
								updateLocalCache((lc) => ({
									...lc,
									accounts: [
										signedInAccount,
										...lc.accounts.filter((a) => a.ms !== signedInAccount.ms),
									],
								}));
								return goto(`/__${gs.urlInMs}`);
							}
							let res = await trpc().signIn.mutate({
								email: normalizedEmail,
								password,
							});
							if (res.fail) return alert(m.anErrorOccurred());
							if (res.otpMs) {
								otpMs = res.otpMs;
								email = normalizedEmail;
								pin = dev ? '00000000' : '';
							}
							onAccountAuth(res.account);
						} else {
							let res = await trpc().sendOtp.mutate({
								email,
								partCode: p.creatingAccount
									? pc.createAccountOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount
									: pc.resetPasswordOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount,
							});
							name = name.trim();
							otpMs = res.otpMs;
							email = normalizedEmail;
							pin = dev ? '00000000' : '';
						}
					} catch (error) {
						console.error(error);
						alert(error);
					}
				}}
			>
				{#if p.creatingAccount}
					<p class="mt-2 font-bold">{m.name()}</p>
					<input
						required
						bind:value={name}
						type="name"
						maxlength={88}
						autocomplete="given-name"
						class="font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1 border-l-0 border-bg8"
					/>
				{/if}
				<p class="mt-2 font-bold">{m.email()}</p>
				<input
					required
					bind:value={email}
					type="email"
					minlength={6}
					maxlength={254}
					autocomplete="username"
					class="font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1 border-l-0 border-bg8"
				/>
				{#if p.creatingAccount || p.signingIn}
					{@render pwInputs()}
				{/if}
				{#if !p.resettingPassword}
					<p class="mt-2 text-base">
						{p.signingIn ? m.newToMindapp() : m.alreadyHaveAnAccount()}
						<a href={p.signingIn ? '/create-account' : '/sign-in'} class="text-hl1 hover:text-hl2">
							{p.signingIn ? m.createAccount() : m.signIn()}
						</a>
					</p>
				{/if}
				{@render continueAndChangeEmailBtn()}
			</form>
		{/if}
	</div>
</div>
