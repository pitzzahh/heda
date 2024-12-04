import type { default_phases, default_three_phase_types } from "@/constants";

export type Phase = (typeof default_phases)[keyof typeof default_phases];

export type PhaseType = (typeof default_three_phase_types)[keyof typeof default_three_phase_types];