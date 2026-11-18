<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { DwellingCircuit } from '#lib/types/load.js';
	import type { FormLoadTypeOption } from '../generic-phase-main-load-form.svelte';

	interface Props {
		form: FormStore;
		load_type: FormLoadTypeOption | undefined;
	}

	const NONE_LABEL = 'Not a dwelling circuit';
</script>

<script lang="ts">
	import { Field } from '@formisch/svelte';
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { selectTrigger } from '#lib/components/ui/select/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { DWELLING_CIRCUITS } from '#lib/constants.js';
	import { getOptionLabel } from '#lib/utils/format.js';
	import { cn } from '#lib/utils/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';

	let { form, load_type }: Props = $props();

	let open = $state(false);
	const trigger_id = useId();

	function pick(
		value: DwellingCircuit | undefined,
		onInput: (value: DwellingCircuit | undefined) => void
	) {
		onInput(value);
		open = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<Field of={form} path={['dwelling_circuit']}>
	{#snippet children(field)}
		<div
			class={cn('flex min-w-0 flex-col gap-2', {
				'cursor-not-allowed': load_type === 'DEFAULT'
			})}
		>
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>Dwelling circuit</Label>
				<Popover.Trigger
					id={trigger_id}
					class={cn(selectTrigger(), 'w-full min-w-0 justify-between', {
						'text-muted-foreground': !field.input,
						'cursor-not-allowed': load_type === 'DEFAULT'
					})}
					disabled={load_type === 'DEFAULT'}
					role="combobox"
				>
					<span class="min-w-0 flex-1 truncate text-left">
						{field.input ? getOptionLabel(DWELLING_CIRCUITS, field.input as string) : NONE_LABEL}
					</span>
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Group>
							<Command.Item value={NONE_LABEL} onSelect={() => pick(undefined, field.onInput)}>
								{NONE_LABEL}
								<CheckIcon class={cn('ml-auto size-4', { 'opacity-0': !!field.input })} />
							</Command.Item>
							{#each DWELLING_CIRCUITS as option (option.value)}
								<Command.Item
									value={option.label}
									onSelect={() => pick(option.value, field.onInput)}
								>
									{option.label}
									<CheckIcon
										class={cn('ml-auto size-4', option.value !== field.input && 'opacity-0')}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<p class="text-[0.8rem] text-muted-foreground">
				PEC 2017 2.10.1.11(C) rates these dwelling circuits 20 A.
			</p>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
