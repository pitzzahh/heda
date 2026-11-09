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
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { AMBIENT_TEMPERATURES } from '#lib/constants/index.js';
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

<Field of={form} path={['ambient_temperature']}>
	{#snippet children(field)}
		<div class="flex min-w-0 flex-col gap-2">
			<Popover.Root bind:open>
				<Label class={cn(field.errors && 'text-destructive')}>Ambient Temperature</Label>
				<Popover.Trigger
					id={trigger_id}
					class={cn(
						buttonVariants({ variant: 'outline' }),
						'w-full min-w-0 justify-between',
						!field.input && 'text-muted-foreground'
					)}
					role="combobox"
				>
					{field.input ? field.input : 'Select an ambient temperature'}
					<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search a terminal temp..." class="h-9" />
						<Command.Empty>No terminal temp found.</Command.Empty>
						<Command.Group>
							<ScrollArea class="h-64 pr-2.5">
								{#each AMBIENT_TEMPERATURES as ambient_temp (ambient_temp)}
									<Command.Item
										value={ambient_temp.toString()}
										onSelect={() => {
											field.onInput(ambient_temp);
											closeAndFocus();
										}}
										disabled={ambient_temp !== 30}
									>
										{ambient_temp}
										<CheckIcon
											class={cn('ml-auto size-4', ambient_temp !== field.input && 'opacity-0')}
										/>
									</Command.Item>
								{/each}
							</ScrollArea>
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<p class="text-muted-foreground text-[0.8rem]">
				This is the ambient temp that will determine the ambient temp of the panel wire to the main.
			</p>
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
