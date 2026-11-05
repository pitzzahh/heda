<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button';
	import { heda_logo_for_dark, heda_logo_for_light } from '#lib/assets/index';
	import { WarningCircleIcon } from '#lib/assets/icons';
	import { cn } from '#lib/utils';

	let title = $state(`${page.status}: ${page.error?.message}`);
	let description = $state('Oops! Something went wrong. Please try again later.');
	let return_to = $state('/');
	let with_return_button = $state(true);
	let title_size = $state('text-7xl');
	let description_size = $state('text-base');
	let centered = $state(true);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div
	class={cn(
		'blueprint-grid relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-6',
		{
			'h-full': centered
		}
	)}
>
	<div aria-hidden="true" class="blueprint-fade pointer-events-none absolute inset-0"></div>
	<div class="relative flex flex-col items-center gap-6 text-center">
		<img src={heda_logo_for_dark} alt="HEDA logo" class="hidden h-28 opacity-90 dark:block" />
		<img src={heda_logo_for_light} alt="HEDA logo" class="block h-28 opacity-90 dark:hidden" />

		<div
			class="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] uppercase"
		>
			<WarningCircleIcon class="size-4" />
			Error {page.status}
		</div>

		<div class="grid gap-2">
			<h1 class={cn('max-w-4xl font-extrabold tracking-[-0.03em] text-balance', title_size)}>
				{title}
			</h1>
			<p class={cn('text-muted-foreground mx-auto max-w-md', description_size)}>{description}</p>
		</div>
	</div>
	{#if with_return_button}
		<Button href={return_to} size="lg" class="relative">Go to Home</Button>
	{/if}
</div>
