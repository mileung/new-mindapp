<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { IconChevronRight } from '@tabler/icons-svelte';

	let spaceMsVal = $state('');
</script>

<div class="xy min-h-screen p-5">
	<div class="w-full max-w-sm">
		<div class="min-h-52">
			<p class="text-4xl sm:text-5xl font-black">
				{m.shareIdeas()}
			</p>
			<p class="mt-2 text-xl sm:text-2xl font-extrabold">{m.createNewSpace()}</p>
			<form
				class="mt-2"
				onsubmit={async (e) => {
					e.preventDefault();
					try {
						// let res = await trpc().auth.verifyOtp.mutate
						// goto(`/__${gs.currentSpaceMs}`, {});
					} catch (error) {
						console.log('error:', error);
						alert(error);
					}
				}}
			>
				<!-- <input
					bind:value={spaceMsVal}
					class="bg-bg4 w-full px-2 h-9 text-lg"
					required
					{...{
						maxlength: 16,
						minlength: 1,
						inputmode: 'numeric',
						oninput: (e) => {
							spaceMsVal = e.currentTarget.value.replace(/[^0-9]/g, '');
						},
						placeholder: m.spaceMs(),
					}}
				/> -->
				<button
					type="submit"
					class="mt-2 fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1 hover:border-hl2"
				>
					{m.continue()}
					<IconChevronRight class="h-5" stroke={3} /></button
				>
			</form>
			<!-- <div class="mt-4 h-0.5 w-full bg-bg8"></div>
			<p class="mt-2 text-xl sm:text-2xl font-extrabold">{m.addExistingSpace()}</p>
			<form
				class="mt-2"
				onsubmit={async (e) => {
					e.preventDefault();
					try {
						// let res = await trpc().auth.verifyOtp.mutate
						// goto(`/__${gs.currentSpaceMs}`, {});
					} catch (error) {
						console.log('error:', error);
						alert(error);
					}
				}}
			>
				<input
					bind:value={spaceMsVal}
					class="bg-bg4 w-full px-2 h-9 text-lg"
					required
					{...{
						maxlength: 16,
						minlength: 1,
						inputmode: 'numeric',
						oninput: (e) => {
							spaceMsVal = e.currentTarget.value.replace(/[^0-9]/g, '');
						},
						placeholder: m.spaceMs(),
					}}
				/>
				<button
					type="submit"
					class="mt-2 fx z-50 h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 border-b-4 border-hl1 hover:border-hl2"
				>
					{m.continue()}
					<IconChevronRight class="h-5" stroke={3} /></button
				>
			</form> -->
		</div>
	</div>
</div>
