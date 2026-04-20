<script lang="ts">
	let p: {
		ms?: number;
		class?: string;
		mirrored?: boolean;
	} = $props();

	let largePrimeNumber = 2654435761;
	let size = 100;
	let padding = 10;
	let gridSize = 5;
	let cellSize = $derived((size - padding * 2) / gridSize);
	let overlap = 0.8;
	let halfWidth = $derived(Math.ceil(gridSize / 2));

	let cyrb53 = (str: string, seed: number = 0): number => {
		let h1 = 0xdeadbeef ^ seed;
		let h2 = 0x41c6ce57 ^ seed;
		for (let i = 0, ch: number; i < str.length; i++) {
			ch = str.charCodeAt(i);
			h1 = Math.imul(h1 ^ ch, 2654435761);
			h2 = Math.imul(h2 ^ ch, 1597334677);
		}
		h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
		h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
		h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
		h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
		return 4294967296 * (2097151 & h2) + (h1 >>> 0);
	};

	let msHash = $derived(cyrb53('' + p.ms));
	let fillColor = $derived.by(() => `hsl(${msHash % 360}, 58%, 58%)`);
	let grid = $derived.by(() => {
		let n = gridSize * (p.mirrored ? halfWidth : gridSize);
		let bits = Array.from({ length: n }, (_, i) => {
			let h = ((msHash ^ (i * largePrimeNumber)) >>> 0) * 2654435761;
			h ^= h >>> 16;
			return Math.imul(h, 2246822507) & 1;
		});
		if (!bits.some(Boolean)) bits = bits.map(() => 1);
		return Array.from({ length: gridSize }, (_, row) =>
			Array.from({ length: gridSize }, (_, col) => {
				let mirrorCol = col < halfWidth ? col : gridSize - 1 - col;
				return bits[row * (p.mirrored ? halfWidth : gridSize) + (p.mirrored ? mirrorCol : col)];
			}),
		);
	});
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="100"
	height="100"
	viewBox="0 0 100 100"
	class={p.class}
	fill={fillColor}
>
	{#each grid as row, rowIndex}
		{#each row as filled, colIndex}
			{#if filled}
				<rect
					x={padding + colIndex * cellSize - overlap}
					y={padding + rowIndex * cellSize - overlap}
					width={cellSize + overlap * 2}
					height={cellSize + overlap * 2}
				/>
			{/if}
		{/each}
	{/each}
</svg>
