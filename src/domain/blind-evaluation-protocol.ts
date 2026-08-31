import type { OfficialFixtureKey } from './artifact-matrix'
import type { CameraDirectionPresetKey, CameraElevationPresetKey, OutputSizePresetKey } from './camera-output-preset'
import type { OfficialRendererVariantKey } from './renderer-variant'

import { OFFICIAL_FIXTURE_KEYS } from './artifact-matrix'
import { OFFICIAL_CAMERA_DIRECTION_PRESETS, OFFICIAL_CAMERA_ELEVATION_PRESETS } from './camera-output-preset'
import { BLIND_EVALUATION_RENDERER_VARIANT_KEYS } from './renderer-variant'

type TargetEvaluatorProfile = {
	minimumCount: number
	targetCountIfConvenient: number
	primaryUseCase: 'solo-or-small-team-2d-game-developer-using-pixel-art-prop-assets'
	pixelArtistEligibility: 'eligible-only-when-also-in-primary-game-dev-asset-use-case'
}

type BlindEvaluationStimulusScope = {
	fixtures: ReadonlyArray<OfficialFixtureKey>
	elevations: ReadonlyArray<CameraElevationPresetKey>
	participantOutputSize: OutputSizePresetKey
	diagnosticOutputSizes: ReadonlyArray<OutputSizePresetKey>
	directionsShownTogether: ReadonlyArray<CameraDirectionPresetKey>
	rendererVariantsPerTrial: ReadonlyArray<OfficialRendererVariantKey>
}

type RatingQuestionKey
	= | 'rank-most-usable-as-pixel-art-game-prop-sprites'
		| 'none-usable'
		| 'observed-defects'
		| 'cleanup-notes'

type RatingQuestion = {
	key: RatingQuestionKey
	prompt: string
	required: boolean
}

export type DefectKey
	= | 'weak-or-unclear-silhouette'
		| 'noisy-pixel-clusters'
		| 'excessive-internal-edges'
		| 'muddy-or-over-busy-lighting'
		| 'detail-lost-or-merged-incorrectly'
		| 'inconsistent-appearance-across-views'
		| 'outline-problems'
		| 'palette-color-awkwardness'
		| 'too-voxel-3d-looking'
		| 'other-free-text'

export type DecisionOutcome = 'proceed' | 'revise renderer' | 'narrow scope' | 'stop/rethink'

type BlindEvaluationProtocol = {
	targetEvaluatorProfile: TargetEvaluatorProfile
	stimulusScope: BlindEvaluationStimulusScope
	ratingQuestions: ReadonlyArray<RatingQuestion>
	defectTaxonomy: ReadonlyArray<DefectKey>
	decisionOutcomes: ReadonlyArray<DecisionOutcome>
}

export const OFFICIAL_BLIND_EVALUATION_PROTOCOL = {
	targetEvaluatorProfile: {
		minimumCount: 5,
		targetCountIfConvenient: 7,
		primaryUseCase: 'solo-or-small-team-2d-game-developer-using-pixel-art-prop-assets',
		pixelArtistEligibility: 'eligible-only-when-also-in-primary-game-dev-asset-use-case',
	},
	stimulusScope: {
		fixtures: OFFICIAL_FIXTURE_KEYS,
		elevations: OFFICIAL_CAMERA_ELEVATION_PRESETS.map((preset) => preset.key),
		participantOutputSize: 64,
		diagnosticOutputSizes: [128],
		directionsShownTogether: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key),
		rendererVariantsPerTrial: BLIND_EVALUATION_RENDERER_VARIANT_KEYS,
	},
	ratingQuestions: [
		{
			key: 'rank-most-usable-as-pixel-art-game-prop-sprites',
			prompt: 'Rank A/B/C by most usable as pixel-art game prop sprites.',
			required: true,
		},
		{
			key: 'none-usable',
			prompt: 'Mark whether none of the options are usable.',
			required: true,
		},
		{
			key: 'observed-defects',
			prompt: 'Optionally select observed defects for each option or for the trial as a whole.',
			required: false,
		},
		{
			key: 'cleanup-notes',
			prompt: 'Optionally add short free-text notes on required cleanup.',
			required: false,
		},
	],
	defectTaxonomy: [
		'weak-or-unclear-silhouette',
		'noisy-pixel-clusters',
		'excessive-internal-edges',
		'muddy-or-over-busy-lighting',
		'detail-lost-or-merged-incorrectly',
		'inconsistent-appearance-across-views',
		'outline-problems',
		'palette-color-awkwardness',
		'too-voxel-3d-looking',
		'other-free-text',
	],
	decisionOutcomes: [
		'proceed',
		'revise renderer',
		'narrow scope',
		'stop/rethink',
	],
} as const satisfies BlindEvaluationProtocol
