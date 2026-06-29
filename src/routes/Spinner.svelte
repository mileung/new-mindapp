<script lang="ts">
	let p: { class?: string; size?: number } = $props();
</script>

<svg
	class={`spinner-container ${p.class}`}
	width={p.size}
	height={p.size}
	viewBox="0 0 100 100"
	xmlns="http://www.w3.org/2000/svg"
>
	<circle class="spinner-circle stroke-fg2" cx="50" cy="50" r="45" />
</svg>

<style>
	.spinner-container {
		animation: 2s linear infinite svg-animation;
	}

	@keyframes svg-animation {
		0% {
			transform: rotateZ(0deg);
		}
		100% {
			transform: rotateZ(360deg);
		}
	}

	.spinner-circle {
		display: block;
		fill: transparent;
		stroke-linecap: square;
		stroke-width: 10px;
		transform-origin: 50% 50%;
		stroke-dasharray: 212 283;
		stroke-dashoffset: 0;
	}
</style>
