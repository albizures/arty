export type RendererRule
	= | 'transparent-background'
		| 'orthographic-projection'
		| 'deterministic-face-visibility'
		| 'unfiltered-no-antialias-output'
		| 'simple-flat-face-shading'
		| 'palette-constrained-output'
		| 'integer-aligned-projection'
		| 'deterministic-occlusion'
		| 'quantized-directional-lighting'
		| 'silhouette-outlines'
		| 'internal-edge-suppression'
		| 'isolated-pixel-cleanup'

type RendererRuleSet = {
	includes: ReadonlyArray<RendererRule>
	excludes: ReadonlyArray<RendererRule>
}

export type OfficialRendererVariantKey = 'baseline' | 'conservative' | 'full'

type OfficialRendererVariant = {
	key: OfficialRendererVariantKey
	label: string
	description: string
	audience: 'official'
	rules: RendererRuleSet
}

type DebugRendererRuleToggleKey = 'lighting-only' | 'outline-only' | 'cleanup-only'

type DebugRendererRuleToggle = {
	key: DebugRendererRuleToggleKey
	label: string
	audience: 'developer-debug'
	optional: true
	includedInOfficialArtifacts: false
	includedInBlindEvaluationStimuli: false
	enables: ReadonlyArray<RendererRule>
}

const SHARED_DETERMINISTIC_RULES = [
	'transparent-background',
	'orthographic-projection',
	'deterministic-face-visibility',
	'unfiltered-no-antialias-output',
] as const satisfies ReadonlyArray<RendererRule>

const SPECIALIZED_CONSERVATIVE_RULES = [
	'palette-constrained-output',
	'integer-aligned-projection',
	'deterministic-occlusion',
	'quantized-directional-lighting',
	'silhouette-outlines',
] as const satisfies ReadonlyArray<RendererRule>

const FULL_SPECIALIZED_RULES = [
	'internal-edge-suppression',
	'isolated-pixel-cleanup',
] as const satisfies ReadonlyArray<RendererRule>

export const OFFICIAL_RENDERER_VARIANT_KEYS = [
	'baseline',
	'conservative',
	'full',
] as const satisfies ReadonlyArray<OfficialRendererVariantKey>

export const OFFICIAL_RENDERER_VARIANTS = {
	baseline: {
		key: 'baseline',
		label: 'Baseline',
		description: 'Shared deterministic voxel sprite renderer without specialized pixel-art treatments.',
		audience: 'official',
		rules: {
			includes: [
				...SHARED_DETERMINISTIC_RULES,
				'simple-flat-face-shading',
			],
			excludes: [
				...SPECIALIZED_CONSERVATIVE_RULES,
				...FULL_SPECIALIZED_RULES,
			],
		},
	},
	conservative: {
		key: 'conservative',
		label: 'Conservative',
		description: 'Specialized voxel sprite renderer with palette, alignment, lighting, occlusion, and outlines only.',
		audience: 'official',
		rules: {
			includes: [
				...SHARED_DETERMINISTIC_RULES,
				...SPECIALIZED_CONSERVATIVE_RULES,
			],
			excludes: [
				...FULL_SPECIALIZED_RULES,
			],
		},
	},
	full: {
		key: 'full',
		label: 'Full',
		description: 'Specialized voxel sprite renderer with every conservative rule plus edge suppression and pixel cleanup.',
		audience: 'official',
		rules: {
			includes: [
				...SHARED_DETERMINISTIC_RULES,
				...SPECIALIZED_CONSERVATIVE_RULES,
				...FULL_SPECIALIZED_RULES,
			],
			excludes: [],
		},
	},
} as const satisfies Record<OfficialRendererVariantKey, OfficialRendererVariant>

export const OFFICIAL_RENDERER_MATRIX_VARIANTS = [
	OFFICIAL_RENDERER_VARIANTS.baseline,
	OFFICIAL_RENDERER_VARIANTS.conservative,
	OFFICIAL_RENDERER_VARIANTS.full,
] as const satisfies ReadonlyArray<OfficialRendererVariant>

export const OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS = OFFICIAL_RENDERER_VARIANT_KEYS

export const BLIND_EVALUATION_RENDERER_VARIANT_KEYS = OFFICIAL_RENDERER_VARIANT_KEYS

export const DEBUG_RENDERER_RULE_TOGGLES = {
	'lighting-only': {
		key: 'lighting-only',
		label: 'Lighting only',
		audience: 'developer-debug',
		optional: true,
		includedInOfficialArtifacts: false,
		includedInBlindEvaluationStimuli: false,
		enables: ['quantized-directional-lighting'],
	},
	'outline-only': {
		key: 'outline-only',
		label: 'Outline only',
		audience: 'developer-debug',
		optional: true,
		includedInOfficialArtifacts: false,
		includedInBlindEvaluationStimuli: false,
		enables: ['silhouette-outlines'],
	},
	'cleanup-only': {
		key: 'cleanup-only',
		label: 'Cleanup only',
		audience: 'developer-debug',
		optional: true,
		includedInOfficialArtifacts: false,
		includedInBlindEvaluationStimuli: false,
		enables: [...FULL_SPECIALIZED_RULES],
	},
} as const satisfies Record<DebugRendererRuleToggleKey, DebugRendererRuleToggle>
