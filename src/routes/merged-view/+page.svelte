<script>
	import { getPromptSigningIn, gs } from '$lib/global-state.svelte';
	import PostFeed from '../PostFeed.svelte';
	import PromptSignIn from '../PromptSignIn.svelte';

	let callerMs = $derived(gs.accounts?.[0].ms);
	let promptSignIn = $derived(getPromptSigningIn());
</script>

{#if callerMs === undefined}
	<!--  -->
{:else if promptSignIn}
	<PromptSignIn />
{:else}
	<div class="flex w-full text-fg2 overflow-scroll h-9">
		<!--  -->
	</div>
	<PostFeed />
{/if}
