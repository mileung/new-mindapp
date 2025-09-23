<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="xy flex-col h-screen">
	<h1 class="text-4xl font-semibold">{page.status}</h1>
	<p class="text-2xl">
		{page.status === 404 ? m.pageNotFound() : page.error?.message}
	</p>
</div>
