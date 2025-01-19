<script lang="ts">
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { SidebarHeader, SidebarTree } from '.';
	import Button from '@/components/ui/button/button.svelte';
	import { PlusIcon } from '@/assets/icons';
	import type { DialogState } from '@/state/types';
	import { getState } from '@/state/index.svelte';
	import { DIALOG_STATE_CTX } from '@/state/constants';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { Project } from '@/db/schema';
	import type { Node } from '@/db/schema';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { SelectedNodesActions } from './(components)';
	import { toast } from 'svelte-sonner';

	let {
		ref = $bindable(null),
		generic_phase_panel_form,
		phase_main_load_form,
		project,
		root_node,
		app_pass_phrase,
		file_encryption_salt,
		can_create_project,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>;
		project?: Project;
		root_node: Node;
		app_pass_phrase: string | null;
		file_encryption_salt: string | null;
		can_create_project: boolean;
	} = $props();

	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);

	let disable_create_project = $state(false);

	$effect(() => {
		if (!can_create_project) {
			disable_create_project = true;
			dialogs_state.highestUnit = false;
			toast.warning('Failed to get the APP_PASS_PHRASE', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return;
		}
	});
</script>

<SelectedNodesActions />
<Sidebar.Root bind:ref {...restProps}>
	<SidebarHeader {project} {root_node} {app_pass_phrase} {file_encryption_salt} />
	<Sidebar.Content class="overflow-y-auto">
		<Sidebar.Group>
			<Sidebar.GroupLabel>System Hierarchy</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if root_node?.highest_unit_form}
						<svelte:boundary>
							<SidebarTree
								node={root_node}
								highest_unit={root_node.highest_unit_form}
								{phase_main_load_form}
								{generic_phase_panel_form}
								{project}
							/>

							{#snippet failed(error, reset)}
								<p class="text-sm text-muted-foreground">{error}</p>
								<Button onclick={reset}>Something went horribly wrong. Click to FIX me</Button>
							{/snippet}
						</svelte:boundary>
					{:else}
						<div class="grid h-[85vh] place-content-center">
							<div class="grid gap-2">
								<div class="text-center">
									<p class="text-lg font-bold text-muted-foreground">There is no project yet.</p>
									<p class="text-sm text-muted-foreground">Create a new project to get started.</p>
								</div>

								<!-- OPENS THE HIGHEST UNIT FORM IF THERE'S NO EXISTING PROJECT -->
								<Button
									size="sm"
									disabled={disable_create_project}
									onclick={() => (dialogs_state.highestUnit = true)}
									href="/workspace?new_file=true"
								>
									<PlusIcon className="size-4 ml-3" /> Create a project
								</Button>
							</div>
						</div>
					{/if}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
