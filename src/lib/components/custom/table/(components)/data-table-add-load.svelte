<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { GenericPhaseMainLoadForm } from '@/components/custom/load';
	import { CirclePlus } from '@/assets/icons/lucide';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { type PhaseMainLoadSchema } from '@/schema/load';

	interface Props {
		phase_main_load_form: SuperValidated<PhaseMainLoadSchema>;
	}

	let { phase_main_load_form, ...props }: Props = $props();
</script>

<div class="flex flex-col gap-2 p-1">
	CRKT NO.
	<Dialog.Root {...props}>
		<Dialog.Trigger
			class={buttonVariants({
				variant: 'outline',
				className: 'h-6 w-full bg-primary text-white hover:bg-primary/80 hover:text-white'
			})}
		>
			<CirclePlus class="size-4" />
		</Dialog.Trigger>
		<Dialog.Content class="max-w-[70%]">
			<Dialog.Header>
				<Dialog.Title>Test Main Load Form</Dialog.Title>
				<Dialog.Description>Enter the load details.</Dialog.Description>
			</Dialog.Header>
			<GenericPhaseMainLoadForm {phase_main_load_form} />
		</Dialog.Content>
	</Dialog.Root>
</div>
