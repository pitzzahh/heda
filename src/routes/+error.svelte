<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { Button } from '@/components/ui/button';
	import { heda_logo_for_dark } from '@/assets/index';
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
	class={cn('flex flex-col items-center justify-center space-y-6', {
		'h-[calc(100vh-8rem)]': centered
	})}
>
	<div class="text-center">
		<h1 class="text-depedred mb-4 font-bold {title_size}">{title}</h1>
		<p class="{description_size} text-gray-700">{description}</p>
		<img src={heda_logo_for_dark} alt="App Logo" />
	</div>
	{#if with_return_button}
		<Button href={return_to}>Go Back</Button>
	{/if}
</div>
