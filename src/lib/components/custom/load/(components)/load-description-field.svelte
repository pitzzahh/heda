<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { FormLoadTypeOption } from '../generic-phase-main-load-form.svelte';

	interface Props {
		form: FormStore;
		load_type: FormLoadTypeOption | undefined;
	}
</script>

<script lang="ts">
	import { Field, setInput } from '@formisch/svelte';
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { DEFAULT_LOADS } from '#lib/constants/index.js';
	import { cn } from '#lib/utils/index.js';
	import { toast } from 'svelte-sonner';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';

	let { form, load_type }: Props = $props();

	let open = $state(false);
	const trigger_id = useId();

	function closeAndFocus() {
		open = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}

	function selectDefaultLoad(description: string) {
		setInput(form, { path: ['load_description'], input: description });
		if (load_type === 'DEFAULT') {
			const selected_load = DEFAULT_LOADS.find((f) => f.description === description);
			if (!description || !selected_load) {
				// TODO: Log system error
				return toast.warning('Failed to identify the load description data', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}
			setInput(form, { path: ['varies'], input: selected_load.varies });
			setInput(form, { path: ['continuous'], input: selected_load.continuous });
			setInput(form, { path: ['load_type'], input: selected_load.type });
		}
		closeAndFocus();
	}
</script>

{#if load_type === 'CUSTOM'}
	<Field of={form} path={['load_description']}>
		{#snippet children(field)}
			<div class="flex min-w-0 flex-col gap-2">
				<Label class={cn(field.errors && 'text-destructive')}>Load description</Label>
				<Input
					{...field.props}
					value={(field.input ?? '') as string}
					placeholder="Enter load description"
				/>
				<FieldErrors errors={field.errors} />
			</div>
		{/snippet}
	</Field>
{/if}
{#if load_type === 'DEFAULT'}
	<Field of={form} path={['load_description']}>
		{#snippet children(field)}
			<div class="flex min-w-0 flex-col gap-2">
				<Popover.Root bind:open>
					<Label class={cn(field.errors && 'text-destructive')}>Load description</Label>
					<Popover.Trigger
						id={trigger_id}
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'w-full min-w-0 justify-between',
							!field.input && 'text-muted-foreground'
						)}
						role="combobox"
					>
						<span class="min-w-0 flex-1 truncate text-left">
							{DEFAULT_LOADS.find((s) => s.description === field.input)?.description ??
								'Select a load description'}
						</span>
						<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search a load description..." class="h-9" />
							<Command.Empty>No load description found.</Command.Empty>
							<Command.Group>
								<ScrollArea class="h-64 pr-2.5">
									{#each DEFAULT_LOADS as default_load (default_load.description)}
										<Command.Item
											value={default_load.description}
											onSelect={() => selectDefaultLoad(default_load.description)}
										>
											{default_load.description}
											<CheckIcon
												class={cn(
													'ml-auto size-4',
													default_load.description !== field.input && 'opacity-0'
												)}
											/>
										</Command.Item>
									{/each}
								</ScrollArea>
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<FieldErrors errors={field.errors} />
			</div>
		{/snippet}
	</Field>
{/if}
