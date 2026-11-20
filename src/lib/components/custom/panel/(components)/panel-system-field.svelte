<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { CoordinationSystem } from '#lib/types/coordination.js';
	import { COORDINATION_SYSTEMS } from '#lib/constants.js';

	interface Props {
		form: FormStore;
	}

	type Option = { value: CoordinationSystem | null; label: string };

	const options: Option[] = [{ value: null, label: 'Normal' }, ...COORDINATION_SYSTEMS];
</script>

<script lang="ts">
	import { Field } from '@formisch/svelte';
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { selectTrigger } from '#lib/components/ui/select/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
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

<Field of={form} path={['system']}>
	{#snippet children(field)}
		<div class="flex min-w-0 flex-col gap-2">
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>System</Label>
				<Popover.Trigger
					id={trigger_id}
					class={cn(selectTrigger(), 'w-full min-w-0 justify-between')}
					role="combobox"
				>
					<span class="truncate">
						{options.find((option) => option.value === (field.input ?? null))?.label ?? 'Normal'}
					</span>
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Group>
							{#each options as option (option.value)}
								<Command.Item
									value={option.label}
									onSelect={() => {
										field.onInput(option.value);
										closeAndFocus();
									}}
								>
									{option.label}
									<CheckIcon
										class={cn(
											'ml-auto size-4',
											option.value !== (field.input ?? null) && 'opacity-0'
										)}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<p class="text-[0.8rem] text-muted-foreground">
				Its devices and those below must be selectively coordinated with every supply-side device.
			</p>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
