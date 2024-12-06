<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { File, Folder } from 'lucide-svelte';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import type { Node } from '@/types/project';
	import AddPanelAndViewTrigger from './add-panel-and-view-trigger.svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import SidebarTree from './sidebar-tree.svelte';
	import { getChildNodesByParentId } from '@/db/queries/index';
	import type { ProjectDocType } from '@/db/schema';

	let {
		node,
		isRootNode,
		highest_unit,
		generic_phase_panel_form,
		project_id
	}: {
		node: Node | string;
		isRootNode?: boolean;
		highest_unit: ProjectDocType['highest_unit_form'];
		project_id?: string;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
	} = $props();

	//TODO: FIX the collapsible to not close when a panel is added
	let collapsible_state = $state(false);

	function isNode(node: Node | string): node is Node {
		return (node as Node).id !== undefined;
	}

	function toggle() {
		collapsible_state = !collapsible_state;
	}
</script>

{#await getChildNodesByParentId(project_id || (isNode(node) && node.id) || '')}
	<p style="color: red">loading</p>
{:then children}
	{#if !isRootNode && isNode(node) && node.node_type === 'load'}
		<Sidebar.MenuButton class="data-[active=true]:bg-transparent">
			<File />
			<span>{typeof node === 'string' ? node : node.load_data?.load_description}</span>
		</Sidebar.MenuButton>
	{:else}
		<Sidebar.MenuItem>
			<Collapsible.Root
				open
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
			>
				<Sidebar.MenuButton
					class="hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-primary/20"
				>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<ChevronRight class="transition-transform" {...props} />
						{/snippet}
					</Collapsible.Trigger>

					{@const node_name = typeof node === 'string' ? node : (node.panel_data?.name as string)}
					<AddPanelAndViewTrigger
						id={isNode(node) ? node.id : ''}
						panel_name={node_name}
						{generic_phase_panel_form}
						is_parent_root_node={typeof isRootNode === 'boolean' ? isRootNode : false}
						parent_id={isRootNode && project_id ? project_id : isNode(node) ? node.id : ''}
					>
						<Folder class="size-4" />
						{typeof node === 'string' ? node : node.panel_data?.name}
					</AddPanelAndViewTrigger>
				</Sidebar.MenuButton>

				<Collapsible.Content class="w-full">
					<Sidebar.MenuSub class="w-full">
						{#each children as unknown as Node[] as child, index (index)}
							<SidebarTree node={child} {generic_phase_panel_form} {highest_unit} />
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}
