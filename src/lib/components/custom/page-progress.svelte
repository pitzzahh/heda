<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { navigating } from '$app/state';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/env';

	// Only navigations slower than this surface the bar, so quick hops never flash it.
	const TIME_TO_BE_VISIBLE = 2000;
	const p = tweened(0, {
		duration: 200,
		easing: cubicOut
	});

	// `$app/state`'s `navigating` object is always truthy; its fields are `null` when idle,
	// so `type` is the signal that a navigation is actually in flight.
	const is_navigating = $derived(navigating.type !== null);

	let visible = $state(false);

	function increase() {
		if ($p < 0.2) {
			p.update((_) => _ + 0.04);
		} else if ($p < 0.5) {
			p.update((_) => _ + 0.02);
		} else if ($p < 0.8) {
			p.update((_) => _ + 0.002);
		} else if ($p < 0.99) {
			p.update((_) => _ + 0.0005);
		} else {
			p.set(0);
		}

		if (visible && is_navigating) {
			const rand = Math.round(Math.random() * (300 - 50)) + 50;
			setTimeout(function () {
				increase();
			}, rand);
		}
	}

	// Syncs the bar with SvelteKit's navigation state; re-runs when a navigation starts or ends.
	$effect(() => {
		if (!browser) return;

		if (is_navigating) {
			if (visible) return;
			const show = setTimeout(() => {
				visible = true;
				increase();
			}, TIME_TO_BE_VISIBLE);
			return () => clearTimeout(show);
		}

		if (!visible) return;
		p.update((_) => _ + 0.3);
		let hide: ReturnType<typeof setTimeout> | undefined;
		const settle = setTimeout(() => {
			p.set(1);
			hide = setTimeout(() => {
				visible = false;
				p.set(0);
			}, 100);
		}, 100);
		return () => {
			clearTimeout(settle);
			clearTimeout(hide);
		};
	});
</script>

{#if browser && visible}
	<progress value={$p} transition:fade={{ duration: 300 }}></progress>
{/if}

<style>
	progress {
		position: fixed;
		top: 0;
		z-index: 999;
		left: 0;
		height: 3px;
		width: 100vw;
		border-radius: 9999px;
		box-shadow: 0 0 12px 0 color-mix(in oklab, var(--primary) 45%, transparent);
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
