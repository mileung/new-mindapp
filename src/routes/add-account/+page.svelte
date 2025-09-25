<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let otpSent = $state(false);
	let email = $state('');
</script>

<div class="xy h-screen p-5 min-h-fit">
	<div class="w-full max-w-sm">
		<p class="text-4xl sm:text-5xl font-black">Organize today</p>
		<p class="mt-3 text-xl sm:text-2xl font-extrabold">Sign in</p>
		<form
			class="mt-4 gap-2 fy items-start"
			onsubmit={(e) => {
				e.preventDefault();
			}}
		>
			<input
				id="email"
				bind:value={email}
				class="bg-bg4 w-full px-2 h-9 text-lg"
				type="email"
				name="email"
				placeholder={m.email()}
				autocomplete="email"
				required
			/>
			<button
				type="submit"
				class="fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1"
			>
				{m.continue()}
				<IconChevronRight class="h-5" stroke={3} /></button
			>
		</form>
	</div>
</div>
