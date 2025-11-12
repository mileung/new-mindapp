<script lang="ts">
	let p: {
		data?: string;
		class?: string;
		size?: number;
	} = $props();

	let largePrimeNumber = 2654435761;
	let size = 100;
	let padding = 10;
	let colors = [
		'fill-red-500',
		'fill-orange-500',
		'fill-yellow-500',
		'fill-green-500',
		'fill-blue-500',
		'fill-purple-500',
		'fill-pink-500',
	];

	let gridSize = $derived(p.size ?? 5);
	let data = $derived(p.data || '');
	// data = '' + Math.random();

	let halfWidth = $derived(Math.ceil(gridSize / 2));
	let hash = $derived(
		data.split('').reduce((acc, char, idx) => {
			return ((acc << 5) - acc + char.charCodeAt(0) * (idx + 1)) | 0;
		}, 0),
	);

	let bits = $derived(
		Array.from({ length: gridSize * halfWidth }, (_, i) => {
			let seed = (hash ^ (i * largePrimeNumber)) >>> 0;
			let charCode1 = data.charCodeAt(i % Math.max(data.length, 1)) || 0;
			let charCode2 = data.charCodeAt((i * 7) % Math.max(data.length, 1)) || 0;
			let charCode3 = data.charCodeAt((i * 13) % Math.max(data.length, 1)) || 0;
			let combined = (seed ^ charCode1 ^ charCode2 ^ charCode3) >>> 0;
			return ((combined >> i % 8) & 1) === 1;
		}),
	);

	let grid = $derived(
		Array.from({ length: gridSize }, (_, row) =>
			Array.from({ length: gridSize }, (_, col) => {
				let mirrorCol = col < halfWidth ? col : gridSize - 1 - col;
				return bits[row * halfWidth + mirrorCol];
			}),
		),
	);

	let colorIndex = $derived((hash >>> 0) % colors.length);
	let fillColor = $derived(colors[colorIndex]);
	let cellSize = $derived((size - padding * 2) / gridSize);
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="100"
	height="100"
	viewBox="0 0 100 100"
	class={`${fillColor} ${p.class}`}
>
	{#each grid as row, rowIndex}
		{#each row as filled, colIndex}
			{#if filled}
				<rect
					x={padding + colIndex * cellSize}
					y={padding + rowIndex * cellSize}
					width={cellSize}
					height={cellSize}
				/>
			{/if}
		{/each}
	{/each}
</svg>
