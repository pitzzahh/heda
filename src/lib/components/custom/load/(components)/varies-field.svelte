<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { FormLoadTypeOption } from '../generic-phase-main-load-form.svelte';

	interface Props {
		form: FormStore;
		load_type: FormLoadTypeOption | undefined;
		varies_label: string;
		/** Horsepower → full-load current table for the selected motor type. */
		hp_currents: Readonly<Record<string, string>>;
	}
</script>

<script lang="ts">
	import { Field } from '@formisch/svelte';
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { selectTrigger } from '#lib/components/ui/select/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { formatFraction } from '#lib/utils/format.js';
	import { cn } from '#lib/utils/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';

	let { form, load_type, varies_label, hp_currents }: Props = $props();

	// Object keys list integers ('1', '10') before fractions ('1/2'); full-load
	// current rises with horsepower, so sorting by it restores the table order.
	const hp_options = $derived(
		Object.keys(hp_currents).sort((a, b) => Number(hp_currents[a]) - Number(hp_currents[b]))
	);

	let open = $state(false);
	const trigger_id = useId();

	function closeAndFocus() {
		open = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<Field of={form} path={['varies']}>
	{#snippet children(field)}
		<div
			class={cn('flex min-w-0 flex-col gap-2', { 'cursor-not-allowed': load_type === 'DEFAULT' })}
		>
			{#if varies_label === 'Horsepower Rating'}
				<Popover.Root bind:open>
					<Label class={cn(field.errors && 'text-destructive')}>{varies_label}</Label>
					<Popover.Trigger
						id={trigger_id}
						class={cn(
							selectTrigger(),
							'w-full min-w-0 justify-between',
							!field.input && 'text-muted-foreground',
							{ 'cursor-not-allowed': load_type === 'DEFAULT' }
						)}
						disabled={load_type === 'DEFAULT'}
						role="combobox"
					>
						{@const varies_output = hp_currents[field.input as string]}
						{#if field.input}
							<p class="min-w-0 flex-1 truncate text-left">
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- formatFraction escapes input; only matched digits reach the markup -->
								{@html formatFraction(field.input as string)}
								({varies_output})
							</p>
						{:else}
							<span class="min-w-0 flex-1 truncate text-left"
								>Select a {varies_label.toLowerCase()}</span
							>
						{/if}
						<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input
								autofocus
								placeholder="Search a {varies_label.toLowerCase()}..."
								class="h-9"
							/>
							<Command.Empty>No {varies_label.toLowerCase()} found.</Command.Empty>
							<Command.Group>
								<ScrollArea class="h-64 pr-2.5">
									{#each hp_options as hp_current_rating (hp_current_rating)}
										<Command.Item
											value={hp_current_rating}
											onSelect={() => {
												field.onInput(hp_current_rating);
												closeAndFocus();
											}}
										>
											<!-- eslint-disable-next-line svelte/no-at-html-tags -- formatFraction escapes input; only matched digits reach the markup -->
											{@html formatFraction(hp_current_rating)}
											<CheckIcon
												class={cn(
													'ml-auto size-4',
													hp_current_rating !== field.input && 'opacity-0'
												)}
											/>
										</Command.Item>
									{/each}
								</ScrollArea>
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			{:else}
				<Label class={cn(field.errors && 'text-destructive')}>{varies_label}</Label>
				<Input
					{...field.props}
					inputmode="numeric"
					readonly={load_type === 'DEFAULT'}
					min={1}
					class={cn('text-muted-foreground', { 'cursor-not-allowed': load_type === 'DEFAULT' })}
					value={(field.input ?? '') as string}
					placeholder="Enter {varies_label.toLowerCase()}"
				/>
			{/if}
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
