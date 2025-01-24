<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { Button } from '@/components/ui/button';
	import { heda_logo_for_dark, heda_logo_for_light } from '@/assets/index';
	import { cn } from '@/utils';

	export let title: string = `${page.status}: ${page.error?.message}`;
	export let description: string = 'Oops! Something went wrong. Please try again later.';
	export let return_to: string = browser ? document.referrer : '/dashboard';
	export let with_return_button: boolean = true;
	export let title_size: string = 'text-4xl';
	export let description_size: string = 'text-lg';
	export let centered: boolean = true;
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
		<Button href={return_to}>Try again</Button>
	{/if}
</div>
