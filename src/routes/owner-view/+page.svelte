<script lang="ts">
	import { goto } from '$app/navigation';
	import { getCallerIsOwner, gs } from '$lib/global-state.svelte';
	import PostFeed from '../PostFeed.svelte';

	let test = $state('');
	let test_ = $state('');
	let callerMs = $derived(gs.accounts?.[0].ms);
	let callerIsOwner = $derived(getCallerIsOwner());

	$effect(() => {
		if (gs.accounts && !callerIsOwner) goto('/');
	});
</script>

{#if !gs.accounts}
	<!--  -->
{:else}
	<div class="flex w-full text-fg2 overflow-scroll h-9">
		<!-- -->
	</div>
	<PostFeed />
{/if}
