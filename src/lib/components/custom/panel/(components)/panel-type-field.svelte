<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';

	interface Props {
		form: FormStore;
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
	import { DEFAULT_THREE_PHASE_TYPES_OPTIONS } from '#lib/constants/index.js';
	import { convertToNormalText } from '#lib/utils/format/index.js';
	import { cn } from '#lib/utils/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';

	let { form }: Props = $props();

	let open = $state(false);
	const trigger_id = useId();

	function closeAndFocus() {
		open = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<Field of={form} path={['type']}>
	{#snippet children(field)}
		<div class="flex flex-col space-y-2">
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>Type</Label>
				<Popover.Trigger
					id={trigger_id}
					class={cn(
						buttonVariants({ variant: 'outline' }),
						'justify-between',
						!field.input && 'text-muted-foreground'
					)}
					role="combobox"
				>
					{field.input
						? convertToNormalText(DEFAULT_THREE_PHASE_TYPES_OPTIONS.find((f) => f === field.input))
						: 'Select a panel phase type'}
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search panel phase type..." class="h-9" />
						<Command.Empty>No panel phase type found.</Command.Empty>
						<Command.Group>
							{#each DEFAULT_THREE_PHASE_TYPES_OPTIONS as phase_type_option (phase_type_option)}
								<Command.Item
									value={phase_type_option}
									onSelect={() => {
										field.onInput(phase_type_option as 'WYE' | 'DELTA' | 'ALGO');
										closeAndFocus();
									}}
								>
									{convertToNormalText(phase_type_option)}
									<CheckIcon
										class={cn('ml-auto size-4', phase_type_option !== field.input && 'opacity-0')}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<p class="text-[0.8rem] text-muted-foreground">This is the type for the panel.</p>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
