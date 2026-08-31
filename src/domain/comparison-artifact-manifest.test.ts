import { describe, expect, it } from 'vitest'

import { fixedPhase0ComparisonTrial, PHASE_0_COMPARISON_ARTIFACT_MANIFEST } from './comparison-artifact-manifest'
import { OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'

describe('comparison artifact manifest', () => {
	it('gives the comparison page a fixed generated-artifact contract instead of renderer ownership', () => {
		expect(PHASE_0_COMPARISON_ARTIFACT_MANIFEST).toMatchObject({
			artifactBasePath: '/phase-0/blind-artifacts',
			generatedBy: 'non-ui-artifact-generation-seam',
			artifactSource: 'static-generated-png-files',
			compatibleGenerationHosts: ['typescript-module', 'standalone-node-cli', 'external-rendering-pipeline'],
			consumedBy: 'comparison-page-presentation-only',
			requiresNextRendering: false,
			containsPixelData: false,
			containsRendererControls: false,
		})
		expect(PHASE_0_COMPARISON_ARTIFACT_MANIFEST.trials).toBe(OFFICIAL_BLIND_COMPARISON_TRIALS)
	})

	it('selects the fixed Phase 0 page trial from the manifest without rendering through React or Next', () => {
		expect(fixedPhase0ComparisonTrial()).toBe(OFFICIAL_BLIND_COMPARISON_TRIALS[0])
		expect(fixedPhase0ComparisonTrial().trialId).toBe('chest__elev26__64')
	})

	it('keeps the comparison page compatible with externally generated static artifacts', () => {
		expect(PHASE_0_COMPARISON_ARTIFACT_MANIFEST.artifactSource).toBe('static-generated-png-files')
		expect(PHASE_0_COMPARISON_ARTIFACT_MANIFEST.compatibleGenerationHosts).toContain('external-rendering-pipeline')
		expect(PHASE_0_COMPARISON_ARTIFACT_MANIFEST.requiresNextRendering).toBe(false)
	})

	it('rejects an empty manifest instead of letting the page guess rendering input', () => {
		expect(() => fixedPhase0ComparisonTrial({
			...PHASE_0_COMPARISON_ARTIFACT_MANIFEST,
			trials: [],
		})).toThrowError('Comparison artifact manifest must contain at least one trial.')
	})
})
