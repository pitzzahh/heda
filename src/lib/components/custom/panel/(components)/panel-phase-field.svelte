<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { Phase } from '#lib/types/phase/index.js';

	interface Props {
		form: FormStore;
		main_phase: Phase;
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
	import { DEFAULT_PHASES, default_phases } from '#lib/constants/index.js';
	import { getOptionLabel } from '#lib/utils/format/index.js';
	import { cn } from '#lib/utils/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';

	let { form, main_phase }: Props = $props();

	const is_one_phase = $derived(main_phase === default_phases.ONE_PHASE);

	let open = $state(false);
	const trigger_id = useId();

	function closeAndFocus() {
		open = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<Field of={form} path={['phase']}>
	{#snippet children(field)}
		<div
			class={cn('flex flex-col space-y-2', {
				'cursor-not-allowed': is_one_phase
			})}
		>
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>Phase</Label>
				<Popover.Trigger
					id={trigger_id}
					disabled={is_one_phase}
					class={cn(
						buttonVariants({ variant: 'outline' }),
						'justify-between',
						!field.input && 'text-muted-foreground'
					)}
					role="combobox"
				>
					{field.input ? getOptionLabel(DEFAULT_PHASES, field.input as string) : 'Select a phase'}
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search a panel phase..." class="h-9" />
						<Command.Empty>No panel phase found.</Command.Empty>
						<Command.Group>
							{#each DEFAULT_PHASES as phase_option (phase_option.value)}
								<Command.Item
									value={phase_option.value}
									onSelect={() => {
										field.onInput(phase_option.value as Phase);
										closeAndFocus();
									}}
								>
									{phase_option.label}
									<CheckIcon
										class={cn('ml-auto size-4', phase_option.value !== field.input && 'opacity-0')}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<p class="text-muted-foreground text-[0.8rem]">This is the phase for the panel.</p>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
