<script lang="ts">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { updateLocalCache } from '$lib/types/local-cache';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let val = $state('');
	let email = $state('');
	let otpMs = $state(0);
</script>

<div class="xy h-screen p-5 min-h-fit">
	<div class="w-full max-w-sm">
		<div class="min-h-52">
			{#if email}
				<p class="text-3xl sm:text-4xl font-black">Check your inbox</p>
				<p class="mt-2 text-lg sm:text-xl">Enter the one-time pin we sent to</p>
				<p class="font-bold break-all">{email}</p>
			{:else}
				<p class="text-4xl sm:text-5xl font-black">Organize today</p>
				<p class="mt-3 text-xl sm:text-2xl font-extrabold">Sign in</p>
			{/if}
			<form
				class="mt-4 gap-2 fy items-start"
				onsubmit={async (e) => {
					e.preventDefault();
					try {
						if (email) {
							let res = await trpc().auth.verifyOtp.mutate({
								email,
								pin: val,
								ms: otpMs,
							});
							let { account } = res;
							if (account) {
								updateLocalCache((lc) => {
									if (gs.accounts) {
										lc.accounts = [account, ...gs.accounts.filter((a) => a.ms !== account.ms)];
									}
									return lc;
								});
								goto(`/__${account.currentSpaceMs}`, {});
							} else if (res.strike! > 2) {
								alert(m.tooManyFailedAttempts());
								email = val = '';
							} else alert(m.incorrectOneTimePin());
						} else {
							let trimmedInput = val.trim().toLowerCase();
							if (gs.accounts?.[0].email === trimmedInput) {
								return alert(m.alreadySignedInWithThatEmail());
							} else {
								let signedInAccount = gs.accounts?.find((a) => a.email === trimmedInput);
								if (signedInAccount) {
									goto(`/__${signedInAccount.currentSpaceMs}`, {});
									return updateLocalCache((lc) => {
										lc.accounts = [
											signedInAccount,
											...lc.accounts.filter((a) => a.ms !== signedInAccount.ms),
										];
										return lc;
									});
								}
							}
							email = trimmedInput;
							otpMs = (await trpc().auth.sendOtp.mutate({ email })).ms;
							val = dev ? '00000000' : '';
						}
					} catch (error) {
						console.log('error:', error);
						alert(error);
					}
				}}
			>
				<input
					bind:value={val}
					class="bg-bg4 w-full px-2 h-9 text-lg"
					required
					{...email
						? {
								maxlength: 8,
								minlength: 8,
								inputmode: 'numeric',
								oninput: (e) => {
									val = e.currentTarget.value.replace(/[^0-9]/g, '');
									// TODO: prevent the "Please lengthen this text" thing from showing up as the user is trying to correct a submitted invalid input
								},
								placeholder: m.oneTimePin(),
							}
						: {
								type: 'email',
								maxlength: 254,
								placeholder: m.email(),
								autocomplete: 'email',
							}}
				/>
				<div class="flex items-end w-full justify-between">
					<button
						type="submit"
						class="fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
					>
						{email ? m.signIn() : m.continue()}
						<IconChevronRight class="h-5" stroke={3} /></button
					>
					{#if email}
						<button onclick={() => (email = val = '')} class="text-fg2 hover:text-fg1"
							>Change email</button
						>
					{/if}
				</div>
			</form>
		</div>
	</div>
</div>
