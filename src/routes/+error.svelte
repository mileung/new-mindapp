<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="xy flex-col w-full">
	<h1 class="text-5xl font-semibold">{page.status}</h1>
	<p class="text-3xl font-semibold">
		{page.status === 404 ? m.pageNotFound() : page.error?.message}
	</p>
</div>
