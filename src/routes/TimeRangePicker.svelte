<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { day, formatMs, week } from '$lib/time';
	import { IconCalendarClock, IconX } from '@tabler/icons-svelte';

	let p: {
		msGte?: number;
		msLte?: number;
		onChange: (msGte: null | number, msLte: null | number) => void;
	} = $props();
	let { msGte, msLte } = $derived(p);

	let open = $state(false);
	// let msRangePickerOpen = $state(!false);
	let draftGte = $state<string>('');
	let draftLte = $state<string>('');
	let msToDateInput = (ms: number) => new Date(ms).toISOString().slice(0, 10);
	let dateStrToMs = (val: string) => new Date(val).getTime();
	let applyDraft = () => {
		if (draftGte && draftLte) p.onChange(dateStrToMs(draftGte), dateStrToMs(draftLte) + day - 1);
		else if (draftGte) p.onChange(dateStrToMs(draftGte), null);
		else if (draftLte) p.onChange(null, dateStrToMs(draftLte) + day - 1);
		open = false;
	};
	type MsRangePreset = {
		label: string;
		gte: () => null | number;
		lte: () => null | number;
	};
	let msRangePresets: MsRangePreset[] = $derived([
		{
			label: m.anytime(),
			gte: () => null,
			lte: () => null,
		},
		{
			label: m.today(),
			gte: () => {
				let d = new Date();
				d.setHours(0, 0, 0, 0);
				return d.getTime();
			},
			lte: () => {
				let d = new Date();
				d.setHours(23, 59, 59, 999);
				return d.getTime();
			},
		},
		{
			label: m.yesterday(),
			gte: () => {
				let d = new Date();
				d.setDate(d.getDate() - 1);
				d.setHours(0, 0, 0, 0);
				return d.getTime();
			},
			lte: () => {
				let d = new Date();
				d.setDate(d.getDate() - 1);
				d.setHours(23, 59, 59, 999);
				return d.getTime();
			},
		},
		{
			label: m.last7Days(),
			gte: () => Date.now() - week,
			lte: () => Date.now(),
		},
		{
			label: m.last30Days(),
			gte: () => Date.now() - 30 * day,
			lte: () => Date.now(),
		},
		{
			label: m.last90Days(),
			gte: () => Date.now() - 90 * day,
			lte: () => Date.now(),
		},
	]);
	let applyMsRangePreset = (preset: MsRangePreset) => {
		p.onChange(preset.gte(), preset.lte());
		open = false;
	};
</script>

<button
	class="ml-auto fx pr-1.5 shrink-0 hover:bg-bg4 hover:text-fg1"
	onclick={() => {
		open = !open;
		draftGte = msGte !== undefined ? msToDateInput(msGte) : '';
		draftLte = msLte !== undefined ? msToDateInput(msLte) : '';
	}}
	onkeydown={(e) => e.key === 'Escape' && (open = false)}
>
	<IconCalendarClock stroke={2.5} class="h-4" />
	{#if msGte !== undefined && msLte !== undefined}
		{#if msLte - msGte === day - 1}
			{formatMs(msGte, 'day')}
		{:else}
			{formatMs(msGte, 'day')} - {formatMs(msLte, 'day')}
		{/if}
	{:else if msGte !== undefined}
		{`${formatMs(msGte, 'day')} ≤`}
	{:else if msLte !== undefined}
		{`≤ ${formatMs(msLte, 'day')}`}
	{:else}
		{m.anytime()}
	{/if}
</button>
{#if open}
	<div class="absolute z-50 bg-bg4 text-fg1 top-8 right-0">
		<div class="flex flex-col">
			{#each msRangePresets as preset}
				<button
					class="px-2 py-1 text-left hover:bg-bg7 hover:text-fg3"
					onclick={() => applyMsRangePreset(preset)}
				>
					{preset.label}
				</button>
			{/each}
		</div>
		<div class="h-0.5 mb-1 w-full bg-bg7"></div>
		<label class="group">
			<p class="px-2 text-sm text-fg2 group-hover:text-fg1">{m.from()}</p>
			<div class="flex">
				<input
					type="date"
					class="pl-2 w-32 group-hover:bg-bg7 dark:[color-scheme:dark]"
					bind:value={draftGte}
					max={draftLte || undefined}
				/>
				<button
					class="flex-1 fx justify-between text-fg2 hover:bg-bg7 hover:text-fg1"
					onclick={() => (draftGte = '')}
				>
					<IconX class="h-4" />
				</button>
			</div>
		</label>
		<label class="group">
			<p class="px-2 text-sm text-fg2 group-hover:text-fg1">{m.to()}</p>
			<div class="flex">
				<input
					type="date"
					class="pl-2 w-32 group-hover:bg-bg7 dark:[color-scheme:dark]"
					bind:value={draftLte}
					min={draftGte || undefined}
				/>
				<button
					class="flex-1 fx justify-between text-fg2 hover:bg-bg7 hover:text-fg1"
					onclick={() => (draftLte = '')}
				>
					<IconX class="h-4" />
				</button>
			</div>
		</label>
		<button
			class="w-full px-2 py-1 text-fg1 hover:bg-bg7"
			disabled={!draftGte && !draftLte}
			onclick={applyDraft}
		>
			{m.apply()}
		</button>
	</div>
{/if}
