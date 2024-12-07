<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { navigating } from '$app/stores';
	import { fade } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	const TIME_TO_BE_VISIBLE = 2000;
	const p = tweened(0, {
		duration: 200,
		easing: cubicOut
	});

	let timeout: number;
	let isVisible = false;

	function increase() {
		if ($p >= 0 && $p < 0.2) {
			p.update((_) => _ + 0.04);
		} else if ($p >= 0.2 && $p < 0.5) {
			p.update((_) => _ + 0.02);
		} else if ($p >= 0.5 && $p < 0.8) {
			p.update((_) => _ + 0.002);
		} else if ($p >= 0.8 && $p < 0.99) {
			p.update((_) => _ + 0.0005);
		} else {
			p.set(0);
		}

		if (isVisible && $navigating) {
			const rand = Math.round(Math.random() * (300 - 50)) + 50;
			setTimeout(function () {
				increase();
			}, rand);
		}
	}

	$: if (browser) {
		if (isVisible && $navigating) {
			increase();
		}
		if (!$navigating) {
			p.update((_) => _ + 0.3);
			setTimeout(function () {
				p.set(1);
				setTimeout(function () {
					isVisible = false;
					p.set(0);
				}, 100);
			}, 100);
		}
	}

	onMount(() => {
		// @ts-ignore
		timeout = setTimeout(() => {
			isVisible = true;
		}, TIME_TO_BE_VISIBLE);
	});

	onDestroy(() => {
		isVisible = false;
		p.set(0);
		clearTimeout(timeout);
	});
</script>

{#if browser && isVisible && $navigating}
	<progress value={$p} transition:fade={{ duration: 300 }}></progress>
{/if}

<style>
	progress {
		position: fixed;
		top: 0;
		z-index: 999;
		left: 0;
		height: 4px;
		width: 100vw;
		border-radius: 0;
	}

	progress::-webkit-progress-bar {
		background-color: transparent;
		width: 100%;
	}
	progress {
		background-color: transparent;
	}
	progress::-webkit-progress-value {
		background-color: var(--primary) !important;
	}
	progress::-moz-progress-bar {
		background-color: var(--primary) !important;
	}
	progress {
		color: var(--primary);
	}
</style>
