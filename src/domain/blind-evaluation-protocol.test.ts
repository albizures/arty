import { describe, expect, it } from 'vitest'

import { OFFICIAL_FIXTURE_KEYS } from './artifact-matrix'
import { OFFICIAL_BLIND_EVALUATION_PROTOCOL } from './blind-evaluation-protocol'
import { OFFICIAL_CAMERA_DIRECTION_PRESETS, OFFICIAL_CAMERA_ELEVATION_PRESETS } from './camera-output-preset'
import { BLIND_EVALUATION_RENDERER_VARIANT_KEYS } from './renderer-variant'

describe('official blind evaluation protocol', () => {
	it('defines the target participant profile and count', () => {
		expect(OFFICIAL_BLIND_EVALUATION_PROTOCOL.targetEvaluatorProfile).toEqual({
			minimumCount: 5,
			targetCountIfConvenient: 7,
			primaryUseCase: 'solo-or-small-team-2d-game-developer-using-pixel-art-prop-assets',
			pixelArtistEligibility: 'eligible-only-when-also-in-primary-game-dev-asset-use-case',
		})
	})

	it('defines the official fixture, elevation, renderer, direction, and output-size stimulus scope', () => {
		expect(OFFICIAL_BLIND_EVALUATION_PROTOCOL.stimulusScope).toEqual({
			fixtures: OFFICIAL_FIXTURE_KEYS,
			elevations: OFFICIAL_CAMERA_ELEVATION_PRESETS.map((preset) => preset.key),
			participantOutputSize: 64,
			diagnosticOutputSizes: [128],
			directionsShownTogether: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key),
			rendererVariantsPerTrial: BLIND_EVALUATION_RENDERER_VARIANT_KEYS,
		})
	})

	it('defines required rating questions for ranking, unusable marking, defects, and cleanup notes', () => {
		expect(OFFICIAL_BLIND_EVALUATION_PROTOCOL.ratingQuestions).toEqual([
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
		])
	})

	it('defines the fixed defect taxonomy plus free text', () => {
		expect(OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy).toEqual([
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
		])
	})

	it('defines the allowed decision outcomes', () => {
		expect(OFFICIAL_BLIND_EVALUATION_PROTOCOL.decisionOutcomes).toEqual([
			'proceed',
			'revise renderer',
			'narrow scope',
			'stop/rethink',
		])
	})
})
