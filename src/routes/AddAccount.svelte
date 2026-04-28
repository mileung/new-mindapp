<script lang="ts">
	import { dev } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { promptSum } from '$lib/dom';
	import { getWhoObj, gs, msToSpaceNameTxt } from '$lib/global-state.svelte';
	import { alertError } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { passwordRegexStr, type MyAccount } from '$lib/types/accounts';
	import { updateLocalCache, useCheckedInvite } from '$lib/types/local-cache';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let p: {
		signingIn?: boolean;
		creatingAccount?: boolean;
		resettingPassword?: boolean;
	} = $props();
	let allowResettingPwAfterOtp = $state(false);
	let otpMs = $state(0);
	let name = $state('');
	let pin = $state('');
	let email = $state(page.state.prefilledEmail || '');
	let oldPassword = $state('');
	let password = $state('');
	let reenteredPw = $state('');
	let showingOldPw = $state(false);
	let showingPw = $state(false);
	let showingRePw = $state(false);
	let escapedPw = $derived.by(() => password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	let pwIptProps = $derived({
		minlength: 8,
		maxlength: 64,
		class: 'font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1 border-l-0 border-bg8',
	});

	$effect(() => {
		email = page.state.prefilledEmail || '';
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
			gs.urlToPostFeedMap = {};
			delete gs.accountMsToSpaceMsToCheckedMap[account.ms];
			gs.checkedInvite //
				? useCheckedInvite()
				: goto(`/__${gs.lastSeenInMs}`);
		}
	};
</script>

{#snippet pwInputs()}
	{#if p.resettingPassword && email && email === gs.accounts?.[0].email.txt}
		<div class="mt-2 flex justify-between items-end">
			<p class="mt-2 font-bold">{m.oldPassword()}</p>
			<button
				type="button"
				class="text-fg2 hover:text-fg1"
				onclick={() => (showingOldPw = !showingOldPw)}
			>
				{showingOldPw ? m.hide() : m.show()}
			</button>
		</div>
		<input
			required
			bind:value={oldPassword}
			autocomplete="current-password"
			{...pwIptProps}
			type={showingOldPw ? '' : 'password'}
			pattern={passwordRegexStr}
			title={m.charactersIncludingOnesFromAZAZ_0_9()}
		/>
	{/if}
	<div class="mt-2 flex justify-between items-end">
		<p class="font-bold">{p.resettingPassword ? m.newPassword() : m.password()}</p>
		<button type="button" class="text-fg2 hover:text-fg1" onclick={() => (showingPw = !showingPw)}>
			{showingPw ? m.hide() : m.show()}
		</button>
	</div>
	<input
		required
		bind:value={password}
		autocomplete={p.signingIn ? 'current-password' : 'new-password'}
		{...pwIptProps}
		type={showingPw ? '' : 'password'}
		pattern={passwordRegexStr}
		title={m.charactersIncludingOnesFromAZAZ_0_9()}
	/>
	{#if !p.signingIn}
		<div class="mt-2 flex justify-between items-end">
			<p class="mt-2 font-bold">
				{p.creatingAccount //
					? m.reenterPassword()
					: m.reenterNewPassword()}
			</p>
			<button
				type="button"
				class="text-fg2 hover:text-fg1"
				onclick={() => (showingRePw = !showingRePw)}
			>
				{showingRePw ? m.hide() : m.show()}
			</button>
		</div>
		<input
			required
			bind:value={reenteredPw}
			autocomplete="new-password"
			{...pwIptProps}
			type={showingRePw ? '' : 'password'}
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

<div class="p-2 max-w-sm">
	{#if allowResettingPwAfterOtp}
		<p class="text-xl font-black">{m.resetPassword()}</p>
		<p class="font-bold break-all">{m.forEmail({ e: email })}</p>
		<form
			class="mt-2"
			onsubmit={async (e) => {
				e.preventDefault();
				try {
					let res = await trpc().signIn.mutate({
						...(await getWhoObj()),
						otpMs,
						pin,
						email,
						password,
						resetPassword: true,
					});
					onAccountAuth(res.account);
				} catch (error) {
					alertError(error);
				}
			}}
		>
			{@render pwInputs()}
			{@render continueAndChangeEmailBtn()}
		</form>
	{:else if otpMs}
		<p class="text-xl font-black">{m.checkYourInbox()}</p>
		<p class="mt-2 text-lg">{m.enterTheOneTimePinSentTo()}</p>
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
						strike = res.strike;
						expiredOtp = res.expiredOtp;
						onAccountAuth(res.account);
					} else if (p.resettingPassword) {
						let res = await trpc().checkOtp.mutate({
							otpMs,
							pin,
							email,
						});
						console.log('checkOtp res:', res);
						strike = res?.strike;
						expiredOtp = res?.expiredOtp;
						if (!strike && !expiredOtp) allowResettingPwAfterOtp = true;
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
					alertError(error);
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
		<p class="text-xl font-black">
			{p.resettingPassword //
				? m.resetPassword()
				: p.signingIn
					? m.signIn()
					: m.createAccount()}
		</p>
		{#if gs.checkedInvite}
			<p class="text-fg2">
				{m.joiningN({ n: msToSpaceNameTxt(gs.checkedInvite.partialSpace.ms) })}
			</p>
		{/if}
		{#if p.resettingPassword && email && email === gs.accounts?.[0].email.txt && email === page.state.prefilledEmail}
			<p class="font-bold break-all">{m.forEmail({ e: email })}</p>
		{/if}
		<form
			class="mt-2"
			onsubmit={async (e) => {
				e.preventDefault();
				if ((p.creatingAccount || p.signingIn) && gs.accounts!.length >= 88) {
					return alert(m.placeholderError()); // gs.accounts.length must be lte88
				}
				try {
					let normalizedEmail = email.trim().toLowerCase();
					if (p.resettingPassword && email && email === gs.accounts?.[0].email.txt) {
						if (email !== page.state.prefilledEmail)
							return replaceState('', { prefilledEmail: email });
						if (oldPassword === password) return alert(m.theNewPasswordMustBeDifferent());
						if (promptSum((a, b) => m.enterTheSumOfAAndBToChangePassword({ a, b }))) {
							let res = await trpc().resetPasswordSignedIn.mutate({
								...(await getWhoObj()),
								oldPassword,
								newPassword: password,
							});
							if (res.success) {
								alert(m.passwordSuccessfullyChanged());
								goto(`/_${gs.accounts[0].ms}_`);
							}
						}
					} else if (p.signingIn) {
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
							return goto(`/__${gs.lastSeenInMs}`);
						}
						let res = await trpc().signIn.mutate({
							email: normalizedEmail,
							password,
						});
						if (res.otpMs) {
							otpMs = res.otpMs;
							email = normalizedEmail;
							pin = dev ? '00000000' : '';
						}
						onAccountAuth(res.account);
					} else {
						let res = await trpc().sendOtp.mutate({
							email,
							will: p.creatingAccount //
								? { createAccount: true }
								: { resetPassword: true },
						});
						if (res.fail) return alert(m.anErrorOccurred());
						if (res.otpMs) {
							name = name.trim();
							otpMs = res.otpMs;
							email = normalizedEmail;
							pin = dev ? '00000000' : '';
						}
					}
				} catch (error) {
					alertError(error);
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
			{#if gs.accounts ? gs.accounts?.[0].email.txt !== page.state.prefilledEmail : true}
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
			{/if}
			{#if p.creatingAccount || p.signingIn || (email && email === gs.accounts?.[0].email.txt && email === page.state.prefilledEmail)}
				{@render pwInputs()}
			{/if}
			{#if p.signingIn}
				<div class="flex justify-between">
					<a href="/reset-password" class="text-hl1 hover:text-hl2">
						{m.forgotPassword()}
					</a>
				</div>
			{/if}
			{@render continueAndChangeEmailBtn()}
			<p class={gs.accounts?.[0].ms && p.resettingPassword ? 'hidden' : 'mt-2 text-base'}>
				{p.signingIn ? m.newToMindapp() : m.haveAnAccount()}
				<a href={p.signingIn ? '/create-account' : '/sign-in'} class="text-hl1 hover:text-hl2">
					{p.signingIn ? m.createAccount() : m.signIn()}
				</a>
			</p>
		</form>
	{/if}
</div>
