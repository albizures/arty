import { describe, expect, it } from 'vitest'

import { OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'
import {
	comparisonInspectionBackgroundStyle,
	comparisonPageTrialPreview,
	nearestNeighborEnlargementScale,
	phase0ComparisonPageScopeDecision,
} from './comparison-page-preview'

describe('comparison page previews', () => {
	it('builds actual-size and nearest-neighbor enlarged previews for a 64px blind trial', () => {
		const trial = OFFICIAL_BLIND_COMPARISON_TRIALS.find((candidate) => candidate.outputSize === 64)
		expect(trial).toBeDefined()

		const pageTrial = comparisonPageTrialPreview(trial ?? OFFICIAL_BLIND_COMPARISON_TRIALS[0]!, {
			artifactBasePath: '/phase-0/blind-artifacts/',
		})

		expect(pageTrial.context).toMatchObject({ outputSize: 64 })
		expect(pageTrial.stimulusSets.map((stimulusSet) => stimulusSet.blindLabel)).toEqual(['A', 'B', 'C'])

		for (const stimulusSet of pageTrial.stimulusSets) {
			for (const artifact of stimulusSet.artifacts) {
				expect(artifact.actualSize).toMatchObject({
					mode: 'actual-size',
					scale: 1,
					width: 64,
					height: 64,
					imageRendering: 'auto',
				})
				expect(artifact.enlarged).toMatchObject({
					mode: 'nearest-neighbor-enlarged',
					scale: 4,
					width: 256,
					height: 256,
					imageRendering: 'pixelated',
				})
				expect(artifact.actualSize.artifactPath).toBe(`/phase-0/blind-artifacts/${artifact.actualSize.artifactName}`)
				expect(artifact.enlarged.artifactPath).toBe(artifact.actualSize.artifactPath)
			}
		}
	})

	it('builds a 2x nearest-neighbor enlarged preview for 128px blind trials', () => {
		const trial = OFFICIAL_BLIND_COMPARISON_TRIALS.find((candidate) => candidate.outputSize === 128)
		expect(trial).toBeDefined()

		const pageTrial = comparisonPageTrialPreview(trial ?? OFFICIAL_BLIND_COMPARISON_TRIALS[0]!, {
			artifactBasePath: '/phase-0/blind-artifacts',
		})

		expect(pageTrial.context).toMatchObject({ outputSize: 128 })
		expect(pageTrial.stimulusSets[0]?.artifacts[0]?.actualSize).toMatchObject({ scale: 1, width: 128, height: 128 })
		expect(pageTrial.stimulusSets[0]?.artifacts[0]?.enlarged).toMatchObject({ scale: 2, width: 256, height: 256, imageRendering: 'pixelated' })
	})

	it('rejects unsupported output sizes instead of guessing preview scale', () => {
		expect(nearestNeighborEnlargementScale(64)).toBe(4)
		expect(nearestNeighborEnlargementScale(128)).toBe(2)
		expect(() => nearestNeighborEnlargementScale(96)).toThrowError('Unsupported comparison preview output size: 96')
	})

	it('rejects non-positive source sizes instead of rendering broken previews', () => {
		const trial = {
			...OFFICIAL_BLIND_COMPARISON_TRIALS[0]!,
			outputSize: 0,
		}

		expect(() => comparisonPageTrialPreview(trial as typeof OFFICIAL_BLIND_COMPARISON_TRIALS[number], { artifactBasePath: '/phase-0/blind-artifacts' })).toThrowError(
			'Unsupported comparison preview output size: 0',
		)
	})

	it('describes inspection backgrounds without changing exported artifact pixels', () => {
		const pageTrial = comparisonPageTrialPreview(OFFICIAL_BLIND_COMPARISON_TRIALS[0] ?? OFFICIAL_BLIND_COMPARISON_TRIALS[1]!, {
			artifactBasePath: '/phase-0/blind-artifacts',
		})
		const artifact = pageTrial.stimulusSets[0]?.artifacts[0]
		expect(artifact).toBeDefined()

		expect(comparisonInspectionBackgroundStyle('transparent')).toEqual({ backgroundColor: 'transparent' })
		expect(comparisonInspectionBackgroundStyle('checkerboard')).toEqual({
			backgroundColor: '#ffffff',
			backgroundImage: 'linear-gradient(45deg, #c8c8c8 25%, transparent 25%), linear-gradient(-45deg, #c8c8c8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #c8c8c8 75%), linear-gradient(-45deg, transparent 75%, #c8c8c8 75%)',
			backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
			backgroundSize: '16px 16px',
		})
		expect(comparisonInspectionBackgroundStyle('dark')).toEqual({ backgroundColor: '#202020' })
		expect(artifact?.actualSize.artifactPath).toBe(artifact?.enlarged.artifactPath)
	})

	it('keeps Phase 0 comparison page scope limited to unpolished evidence review', () => {
		expect(phase0ComparisonPageScopeDecision('checkerboard-background-inspection')).toEqual({
			accepted: true,
			reason: 'Phase 0 comparison page evidence review.',
		})

		expect(phase0ComparisonPageScopeDecision('voxel-editing')).toEqual({
			accepted: false,
			reason: 'voxel-editing is out of scope for the Phase 0 comparison page.',
		})
		expect(phase0ComparisonPageScopeDecision('renderer-controls')).toMatchObject({ accepted: false })
		expect(phase0ComparisonPageScopeDecision('manual-2d-correction-tools')).toMatchObject({ accepted: false })
		expect(phase0ComparisonPageScopeDecision('account-session-systems')).toMatchObject({ accepted: false })
		expect(phase0ComparisonPageScopeDecision('product-grade-navigation')).toMatchObject({ accepted: false })
		expect(phase0ComparisonPageScopeDecision('generalized-asset-browsing')).toMatchObject({ accepted: false })
	})
})
