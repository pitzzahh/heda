<script lang="ts" module>
	import { PlusIcon, DatabaseIcon } from '#lib/assets/icons';
	import type { ComponentProps } from 'svelte';
	import type { Root as SidebarRoot } from '#lib/components/ui/sidebar/index.js';
	import type { Project, Node } from '#lib/types/db';

	type Props = ComponentProps<typeof SidebarRoot> & {
		project?: Project;
		root_node: Node;
	};
</script>

<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { SidebarHeader, SidebarTree } from '.';
	import Button from '#lib/components/ui/button/button.svelte';
	import type { DialogState } from '#lib/state/types';
	import { getState } from '#lib/state/index.svelte';
	import { DIALOG_STATE_CTX } from '#lib/state/constants';
	import { SelectedNodesActions } from './(components)';

	let { ref = $bindable(null), project, root_node, ...restProps }: Props = $props();

	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
</script>

<SelectedNodesActions />
<Sidebar.Root bind:ref {...restProps}>
	<SidebarHeader {root_node} />
	<Sidebar.Content class="overflow-y-auto">
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="text-muted-foreground px-3 text-[10px] font-bold tracking-[0.22em] uppercase"
			>
				System Hierarchy
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if root_node?.highest_unit_form}
						<svelte:boundary>
							<SidebarTree node={root_node} highest_unit={root_node.highest_unit_form} {project} />

							{#snippet failed(error, reset)}
								<div class="grid gap-2 rounded-xl border border-dashed p-4 text-center">
									<p class="text-muted-foreground text-sm">{error}</p>
									<Button onclick={reset} variant="outline" size="sm">Try again</Button>
								</div>
							{/snippet}
						</svelte:boundary>
					{:else}
						<div class="grid place-items-center px-4 py-16">
							<div class="grid w-full max-w-60 justify-items-center gap-4 text-center">
								<div
									class="border-sidebar-border text-muted-foreground grid size-16 place-items-center rounded-2xl border border-dashed"
								>
									<DatabaseIcon class="size-7" />
								</div>
								<div class="grid gap-1">
									<p class="text-sm font-bold tracking-tight">No project yet</p>
									<p class="text-muted-foreground text-xs leading-5">
										Create a project to start building the hierarchy.
									</p>
								</div>

								<!-- OPENS THE HIGHEST UNIT FORM IF THERE'S NO EXISTING PROJECT -->
								<Button
									size="sm"
									class="w-full"
									onclick={() => (dialogs_state.highestUnit = true)}
									href="/workspace?new_file=true"
								>
									<PlusIcon class="size-4" /> Create a project
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
