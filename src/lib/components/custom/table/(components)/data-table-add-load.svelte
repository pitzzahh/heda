<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { GenericPhaseMainLoadForm } from '@/components/custom/load';
	import { CirclePlus } from '@/assets/icons';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { type PhaseMainLoadSchema } from '@/schema/load';
	import type { HighestUnitSchema } from '@/schema';
	import { cn } from '@/utils';

	interface Props {
		phase_main_load_form: SuperValidated<PhaseMainLoadSchema>;
		highest_unit: HighestUnitSchema;
	}

	let { phase_main_load_form, highest_unit, ...props }: Props = $props();

	const { distribution_unit, phase } = highest_unit;

	let is_dialog_open = $state(false);
</script>

<div class="flex flex-col gap-2 p-1">
	CRKT NO.
	<Dialog.Root {...props} bind:open={is_dialog_open}>
		<Dialog.Trigger
			class={buttonVariants({
				variant: 'outline',
				className: 'h-6 w-full bg-primary text-white hover:bg-primary/80 hover:text-white'
			})}
		>
			<CirclePlus class="size-4" />
		</Dialog.Trigger>
		<Dialog.Content class="max-w-[85%]">
			<Dialog.Header>
				<Dialog.Title>Add load</Dialog.Title>
				<Dialog.Description>Enter the load details.</Dialog.Description>
				<div class={cn('flex flex-col items-center justify-start')}>
					<h4 class="mb-1 font-bold">MAIN</h4>
					<div class="grid w-full grid-cols-2 justify-items-start">
						<div>
							<div class="flex gap-1">
								<h4 class="font-semibold">Name:</h4>
								<p>{distribution_unit ?? 'N/A'}</p>
							</div>
						</div>
						<div>
							<div class="flex gap-1">
								<h4 class="font-semibold">Phase:</h4>
								<p>{phase ?? 'N/A'}</p>
							</div>
						</div>
					</div>
				</div>
			</Dialog.Header>
			<GenericPhaseMainLoadForm
				action={'add'}
				closeDialog={() => (is_dialog_open = false)}
				{phase_main_load_form}
			/>
		</Dialog.Content>
	</Dialog.Root>
</div>
