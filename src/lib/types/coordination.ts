import type * as v from 'valibot';
import type { COORDINATION_REFERENCE_SCHEMA } from '#lib/validators/coordination.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel.js';

export type CoordinationReferenceInput = v.InferOutput<typeof COORDINATION_REFERENCE_SCHEMA>;

export type CoordinationSystem = NonNullable<GenericPhasePanelSchema['system']>;

// Engine payload shapes (`crates/heda-core/src/coordination.rs`).
export type CoordinationDevice = { id: string; name: string; at: number; af: number };

export type CoordinationStatus =
	| { kind: 'exempt' }
	| { kind: 'not_selective' }
	| { kind: 'documented'; reference: string }
	| { kind: 'needs_documentation' };

export type CoordinationPair = {
	system: CoordinationSystem;
	section: string;
	upstream: CoordinationDevice;
	downstream: CoordinationDevice;
	/** Available fault current at the downstream device, A. */
	available_fault_current: number | null;
	status: CoordinationStatus;
};
