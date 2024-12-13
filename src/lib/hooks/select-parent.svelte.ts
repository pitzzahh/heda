import { getNodeById } from '@/db/queries';

export function parentSelector(parent_id: string) {
	let selected_parent = $state<{ name: string; id: string } | null>(null);

	$effect.root(() => {
		getNodeById(parent_id).then((node) => {
			selected_parent = {
				name: node?.highest_unit_form?.distribution_unit || node?.panel_data?.name || '',
				id: node?.id || ''
			};
		});
	});

	function selectParent(parent: { name: string; id: string }) {
		selected_parent = parent;
	}

	return {
		selected_parent,
		selectParent
	};
}
