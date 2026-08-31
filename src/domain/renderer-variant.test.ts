import { describe, expect, it } from 'vitest'

import {
	BLIND_EVALUATION_RENDERER_VARIANT_KEYS,
	DEBUG_RENDERER_RULE_TOGGLES,
	OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS,
	OFFICIAL_RENDERER_MATRIX_VARIANTS,
	OFFICIAL_RENDERER_VARIANT_KEYS,
	OFFICIAL_RENDERER_VARIANTS,
} from './renderer-variant'

describe('official renderer variants', () => {
	it('exposes exactly the stable official renderer keys in matrix order', () => {
		expect(OFFICIAL_RENDERER_VARIANT_KEYS).toEqual(['baseline', 'conservative', 'full'])
		expect(Object.keys(OFFICIAL_RENDERER_VARIANTS)).toEqual(['baseline', 'conservative', 'full'])
		expect(OFFICIAL_RENDERER_MATRIX_VARIANTS.map((variant) => variant.key)).toEqual(['baseline', 'conservative', 'full'])
		expect(OFFICIAL_RENDERER_MATRIX_VARIANTS.every((variant) => variant.audience === 'official')).toBe(true)
	})

	it('declares baseline rules as shared deterministic rendering only', () => {
		expect(OFFICIAL_RENDERER_VARIANTS.baseline.rules).toEqual({
			includes: [
				'transparent-background',
				'orthographic-projection',
				'deterministic-face-visibility',
				'unfiltered-no-antialias-output',
				'simple-flat-face-shading',
			],
			excludes: [
				'palette-constrained-output',
				'integer-aligned-projection',
				'deterministic-occlusion',
				'quantized-directional-lighting',
				'silhouette-outlines',
				'internal-edge-suppression',
				'isolated-pixel-cleanup',
			],
		})
	})

	it('declares conservative rules without full cleanup rules', () => {
		expect(OFFICIAL_RENDERER_VARIANTS.conservative.rules).toEqual({
			includes: [
				'transparent-background',
				'orthographic-projection',
				'deterministic-face-visibility',
				'unfiltered-no-antialias-output',
				'palette-constrained-output',
				'integer-aligned-projection',
				'deterministic-occlusion',
				'quantized-directional-lighting',
				'silhouette-outlines',
			],
			excludes: [
				'internal-edge-suppression',
				'isolated-pixel-cleanup',
			],
		})
	})

	it('declares full rules as conservative plus cleanup rules', () => {
		expect(OFFICIAL_RENDERER_VARIANTS.full.rules).toEqual({
			includes: [
				'transparent-background',
				'orthographic-projection',
				'deterministic-face-visibility',
				'unfiltered-no-antialias-output',
				'palette-constrained-output',
				'integer-aligned-projection',
				'deterministic-occlusion',
				'quantized-directional-lighting',
				'silhouette-outlines',
				'internal-edge-suppression',
				'isolated-pixel-cleanup',
			],
			excludes: [],
		})
	})

	it('keeps debug-only rule toggles out of official artifacts and blind stimuli', () => {
		expect(Object.keys(DEBUG_RENDERER_RULE_TOGGLES)).toEqual([
			'lighting-only',
			'outline-only',
			'cleanup-only',
		])
		expect(OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS).toEqual(['baseline', 'conservative', 'full'])
		expect(BLIND_EVALUATION_RENDERER_VARIANT_KEYS).toEqual(['baseline', 'conservative', 'full'])

		for (const toggle of Object.values(DEBUG_RENDERER_RULE_TOGGLES)) {
			expect(Object.keys(OFFICIAL_RENDERER_VARIANTS)).not.toContain(toggle.key)
			expect(OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS).not.toContain(toggle.key)
			expect(BLIND_EVALUATION_RENDERER_VARIANT_KEYS).not.toContain(toggle.key)
			expect(toggle).toMatchObject({
				audience: 'developer-debug',
				optional: true,
				includedInOfficialArtifacts: false,
				includedInBlindEvaluationStimuli: false,
			})
		}
	})
})
