<script lang="ts" module>
	import type { DialogState } from '#lib/state/types.js';

	let dialogs: DialogState | undefined;

	export function get_dialogs() {
		return dialogs as DialogState;
	}
</script>

<script lang="ts">
	import { getState } from '#lib/state/index.svelte.js';
	import { DIALOG_STATE_CTX } from '#lib/state/constants.js';

	dialogs = getState<DialogState>(DIALOG_STATE_CTX);
</script>
