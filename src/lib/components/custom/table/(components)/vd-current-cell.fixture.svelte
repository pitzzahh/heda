<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import type { VoltageDrop } from '#lib/types/voltage-drop.js';
	import VdCurrentCell from './vd-current-cell.svelte';
</script>

<Tooltip.Provider>
	<VdCurrentCell
		current={20}
		is_at_used={false}
		node={{ id: 'node-a', parent_id: 'root', current: 20, at: 30 } as unknown as VoltageDrop}
	/>
</Tooltip.Provider>
