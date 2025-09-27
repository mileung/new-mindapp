<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let email = $state('');
	let otpEmail = $state('');
</script>

<div class="xy h-screen p-5 min-h-fit">
	<div class="w-full max-w-sm">
		<div class="min-h-52">
			{#if otpEmail}
				<p class="text-3xl sm:text-4xl font-black">Check your inbox</p>
				<p class="mt-2 text-lg sm:text-xl">
					Enter the one-time passcode we sent to <span class="font-bold">{otpEmail}</span>
				</p>
			{:else}
				<p class="text-4xl sm:text-5xl font-black">Organize today</p>
				<p class="mt-3 text-xl sm:text-2xl font-extrabold">Sign in</p>
			{/if}
			<form
				class="mt-4 gap-2 fy items-start"
				onsubmit={async (e) => {
					e.preventDefault();
					if (otpEmail) {
						//
					} else {
						otpEmail = email.trim();
						email = '';
						let res = await trpc().auth.sendOtp.mutate({ email: otpEmail });

						console.log('res:', res);
					}
				}}
			>
				<input
					bind:value={email}
					class="bg-bg4 w-full px-2 h-9 text-lg"
					required
					{...otpEmail
						? {
								placeholder: m.oneTimePasscode(),
							}
						: {
								type: 'email',
								placeholder: m.email(),
								autocomplete: 'email',
							}}
				/>
				<div class="flex items-end w-full justify-between">
					<button
						type="submit"
						class="fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
					>
						{otpEmail ? m.signIn() : m.continue()}
						<IconChevronRight class="h-5" stroke={3} /></button
					>
					{#if otpEmail}
						<button onclick={() => (email = otpEmail = '')} class="text-fg2 hover:text-fg1"
							>Change email</button
						>
					{/if}
				</div>
			</form>
		</div>
	</div>
</div>
