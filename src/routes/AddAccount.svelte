<script lang="ts">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { updateLocalCache } from '$lib/types/local-cache';
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
		class: 'font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1',
	});
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
				class="text-hl1 hover:text-hl2"
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
		pattern={`(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,64}`}
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
{#snippet submitRow()}
	<div class="mt-2 flex items-end w-full justify-between">
		<button
			type="submit"
			class="fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
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

<div class="xy min-h-screen p-5">
	<div class="w-full max-w-sm">
		{#if resettingPassword}
			<p class="text-3xl font-black">{m.resetPassword()}</p>
			<p class="font-bold break-all">{m.forEmail({ e: email })}</p>
			<form
				class="mt-2"
				onsubmit={async (e) => {
					e.preventDefault();
					try {
						let res = await trpc().auth.resetPassword.mutate({
							email,
							pin,
							otpMs,
							password,
						});
					} catch (error) {
						console.log('error:', error);
						alert(error);
					}
				}}
			>
				{@render pwInputs()}
				{@render submitRow()}
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
						if (p.signingIn) {
							let res = await trpc().auth.signIn.mutate({
								email,
								password,
								otpMs,
								pin,
							});
							console.log('res:', res);
						} else if (p.creatingAccount) {
							let res = await trpc().auth.createAccount.mutate({
								name,
								email,
								password,
								otpMs,
								pin,
							});
							updateLocalCache((lc) => {
								if (gs.accounts) {
									lc.accounts = [
										res.account,
										...gs.accounts.filter((a) => a.ms !== res.account.ms),
									];
								}
								return lc;
							});
							goto(`/l_l_${gs.currentSpaceMs}`, {});
						} else if (p.resettingPassword) {
							let res = await trpc().auth.checkOtp.mutate({
								otpMs,
								pin,
								email,
							});
							if (res?.strike) {
								if (res.strike > 2) {
									alert(m.tooManyFailedAttempts());
									email = pin = '';
								} else alert(m.incorrectOneTimePin());
							} else resettingPassword = true;
						}
					} catch (error) {
						console.log('error:', error);
						alert(error);
					}
				}}
			>
				<p class="mt-2 font-bold">{m.oneTimePin()}</p>
				<input
					bind:value={pin}
					class="bg-bg4 w-full px-2 h-9 text-lg"
					required
					maxlength={8}
					minlength={8}
					inputmode="numeric"
					oninput={(e) => {
						pin = e.currentTarget.value.replace(/[^0-9]/g, '');
						// TODO: prevent the "Please lengthen this text" thing from showing up as the user is trying to correct a submitted invalid input
					}}
				/>
				{@render submitRow()}
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
					try {
						let normalizedEmail = email.trim().toLowerCase();
						if (p.signingIn) {
							let signedInAccount = gs.accounts?.find((a) => a.email === normalizedEmail);
							if (signedInAccount) {
								updateLocalCache((lc) => {
									lc.accounts = [
										signedInAccount,
										...lc.accounts.filter((a) => a.ms !== signedInAccount.ms),
									];
									return lc;
								});
								return goto(`/l_l_${gs.currentSpaceMs}`);
							}
							let res = await trpc().auth.signIn.mutate({
								email: normalizedEmail,
								password,
							});
							console.log('res:', res);
							if (res.otpMs) {
								otpMs = res.otpMs;
								email = normalizedEmail;
								pin = dev ? '00000000' : '';
							}
							return;
						} else {
							console.log('sendOtp');
							let res = await trpc().auth.sendOtp.mutate({
								email,
								purpose: p.creatingAccount ? 'create-account' : 'reset-password',
							});
							name = name.trim();
							otpMs = res.otpMs;
							email = normalizedEmail;
							pin = dev ? '00000000' : '';
						}
					} catch (error) {
						console.log('error:', error);
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
						class="font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1"
					/>
				{/if}
				<p class="mt-2 font-bold">{m.email()}</p>
				<input
					required
					bind:value={email}
					type="email"
					maxlength={254}
					autocomplete="username"
					class="font-normal text-lg mt-1 w-full p-2 bg-bg5 hover:bg-bg7 text-fg1"
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
				{@render submitRow()}
			</form>
		{/if}
	</div>
</div>
