import type { Node } from '#lib/types/db.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

/** A panelboard in the riser diagram: its computed row, the panels it feeds, its branch breakers. */
export type RiserTree = {
	row: PhaseLoadSchedule;
	panels: RiserTree[];
	/** Breaker ratings (AT) of the branch circuits on this panelboard. */
	branch_ats: number[];
};

/** The service supply drawn above the main panels (the project root's highest unit form). */
export type RiserSource = NonNullable<Node['highest_unit_form']>;

// Diagram geometry (UI shapes, no validation site).
export type RiserBox = {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	title: string;
	lines: string[];
};

export type RiserLabel = { id: string; x: number; y: number; lines: string[] };

export type RiserLayout = {
	width: number;
	height: number;
	boxes: RiserBox[];
	/** Polylines of [x, y] points. */
	wires: [number, number][][];
	labels: RiserLabel[];
	/** Top of each feeder's circuit breaker (PEC 2017 Appendix A 1.11). */
	breakers: [number, number][];
	/** Cross-lines on a feeder, one per wire (Appendix A 1.37). */
	ticks: { x: number; y: number; count: number }[];
	/** Top of the service transformer (Appendix A 3.1), when the project has one. */
	transformer?: [number, number];
	/** Earth ground (PEC 2017 Appendix A 1.3), at the service. */
	ground?: [number, number];
	/** Kilowatt-hour meter (Appendix A 1.7), on the service drop. */
	meter?: [number, number];
};

/** The parts of a layout the drawing renders one element each, after culling. */
export type RiserItems = Pick<RiserLayout, 'boxes' | 'labels' | 'breakers' | 'ticks'>;
