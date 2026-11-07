<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';
	import type { TerminalTemperature } from '#lib/types/load/index.js';

	interface Props {
		form: FormStore;
		hint: string;
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
	import {
		DEFAULT_TERMINAL_TEMPERATURES,
		STANDARD_TERMINAL_TEMPERATURE
	} from '#lib/constants/index.js';
	import { getOptionLabel } from '#lib/utils/format/index.js';
	import { cn } from '#lib/utils/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';

	let { form, hint }: Props = $props();

	let open = $state(false);
	const trigger_id = useId();

	function closeAndFocus() {
		open = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<Field of={form} path={['terminal_temperature']}>
	{#snippet children(field)}
		<div class="flex flex-col space-y-2">
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>Terminal Temperature</Label>
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
						? getOptionLabel(DEFAULT_TERMINAL_TEMPERATURES, field.input as string)
						: 'Select a terminal temperature'}
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search a terminal temp..." class="h-9" />
						<Command.Empty>No terminal temp found.</Command.Empty>
						<Command.Group>
							{#each DEFAULT_TERMINAL_TEMPERATURES as terminal_temp (terminal_temp.value)}
								<Command.Item
									value={terminal_temp.value}
									onSelect={() => {
										field.onInput(terminal_temp.value as TerminalTemperature);
										closeAndFocus();
									}}
									disabled={terminal_temp.value !== STANDARD_TERMINAL_TEMPERATURE}
								>
									{terminal_temp.label}
									<CheckIcon
										class={cn(
											'ml-auto size-4',
											terminal_temp.value !== field.input && 'text-transparent'
										)}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<p class="text-muted-foreground text-[0.8rem]">{hint}</p>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
