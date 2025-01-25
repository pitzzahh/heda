<script module lang="ts">
	export type ErrorPageProps = {
		title?: string;
		description?: string;
		return_to?: string;
		with_return_button?: boolean;
		title_size?: string;
		description_size?: string;
		centered?: boolean;
	};
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '@/components/ui/button';
	import { heda_logo_for_dark, heda_logo_for_light } from '@/assets/index';
	import { cn } from '@/utils';
	let {
		title = $bindable(`${page.status}: ${page.error?.message}`),
		description = $bindable('Oops! Something went wrong. Please try again later.'),
		return_to = $bindable('/'),
		with_return_button = $bindable(true),
		title_size = $bindable('text-4xl'),
		description_size = $bindable('text-lg'),
		centered = $bindable(true)
	}: ErrorPageProps = $props();
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div
	class={cn('flex min-h-screen flex-col items-center justify-center space-y-6', {
		'h-full': centered
	})}
>
	<div class="flex flex-col items-center text-center">
		<h1 class="mb-4 font-bold text-red-500 {title_size}">{title}</h1>
		<p class={description_size}>{description}</p>
		<img src={heda_logo_for_dark} alt="Heda Logo" class="hidden h-80 dark:block" />
		<img src={heda_logo_for_light} alt="Heda Logo" class="block h-80 dark:hidden" />
	</div>
	{#if with_return_button}
		<Button href={return_to}>Go to Home</Button>
	{/if}
</div>
