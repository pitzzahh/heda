<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { LoadType } from '#lib/types/load/index.js';
	import type { FormLoadTypeOption } from '../generic-phase-main-load-form.svelte';

	interface Props {
		form: FormStore;
		load_type: FormLoadTypeOption | undefined;
	}
</script>

<script lang="ts">
	import { Field } from '@formisch/svelte';
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { DEFAULT_LOAD_TYPES } from '#lib/constants/index.js';
	import { getOptionLabel } from '#lib/utils/format/index.js';
	import { cn } from '#lib/utils/index.js';
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
</script>

<Field of={form} path={['load_type']}>
	{#snippet children(field)}
		<div
			class={cn('flex min-w-0 flex-col gap-2', {
				'cursor-not-allowed': load_type === 'DEFAULT'
			})}
		>
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>Load type</Label>
				<Popover.Trigger
					id={trigger_id}
					class={cn(
						buttonVariants({
							variant: 'outline',
							className: 'justify-between'
						}),
						'w-full min-w-0',
						!field.input && 'text-muted-foreground',
						{ 'cursor-not-allowed': load_type === 'DEFAULT' }
					)}
					disabled={load_type === 'DEFAULT'}
					role="combobox"
				>
					<span class="min-w-0 flex-1 truncate text-left">
						{field.input
							? getOptionLabel(DEFAULT_LOAD_TYPES, field.input as string)
							: 'Select a load type'}
					</span>
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search a load type..." class="h-9" />
						<Command.Empty>No load type found.</Command.Empty>
						<Command.Group>
							{#each DEFAULT_LOAD_TYPES as load_type_option (load_type_option.value)}
								<Command.Item
									value={load_type_option.value}
									onSelect={() => {
										field.onInput(load_type_option.value as LoadType);
										closeAndFocus();
									}}
								>
									{load_type_option.label}
									<CheckIcon
										class={cn(
											'ml-auto size-4',
											load_type_option.value !== field.input && 'opacity-0'
										)}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
