import { describe, expect, it } from 'vitest'

import {
	phase0ComparisonHostSummary,
	phase0RenderingEscapeHatchSummary,
	PHASE_0_PROTOTYPE_HOST_DECISION,
} from './prototype-host-decision'

describe('prototype host decision', () => {
	it('records the existing Next/React/TypeScript app as the Phase 0 comparison-page host', () => {
		expect(PHASE_0_PROTOTYPE_HOST_DECISION).toMatchObject({
			phase: 'phase-0',
			comparisonPageHost: 'existing-next-react-typescript-app',
			purpose: 'blind-comparison-evidence-collection',
		})
		expect(PHASE_0_PROTOTYPE_HOST_DECISION.notes).toContain(
			'The existing Next/React/TypeScript app is the default host for the Phase 0 comparison page.',
		)
	})

	it('keeps the Phase 0 host choice from becoming a final MVP editor architecture commitment', () => {
		expect(PHASE_0_PROTOTYPE_HOST_DECISION.finalMvpEditorArchitectureCommitment).toBe(false)
		expect(PHASE_0_PROTOTYPE_HOST_DECISION.notes).toContain(
			'This decision does not commit the project to the final MVP editor architecture.',
		)
	})

	it('records that renderer generation can move outside the Next app shell under deterministic PNG constraints', () => {
		expect(PHASE_0_PROTOTYPE_HOST_DECISION).toMatchObject({
			rendererGenerationLocation: 'separable-non-ui-seam',
			generationEscapeHatch: {
				triggerConstraints: ['pixel-level-determinism', 'canvas-runtime', 'png-encoding-runtime'],
				fallbackGenerationHost: 'outside-next-app-shell',
				defaultStaticPresentationHost: 'existing-next-react-typescript-app',
			},
		})
		expect(PHASE_0_PROTOTYPE_HOST_DECISION.notes).toContain(
			'Deterministic PNG artifact generation may move outside the Next app shell if pixel-level, canvas, or PNG encoding constraints require it.',
		)
		expect(PHASE_0_PROTOTYPE_HOST_DECISION.notes).toContain(
			'Next remains the default host for static artifact presentation unless static presentation also becomes impractical.',
		)
	})

	it('exposes the decision through pure summary seams', () => {
		expect(phase0ComparisonHostSummary()).toBe(
			'phase-0: use the existing-next-react-typescript-app for blind-comparison-evidence-collection; final MVP editor architecture committed: false',
		)
		expect(phase0RenderingEscapeHatchSummary()).toBe(
			'rendering: separable-non-ui-seam; if constrained by pixel-level-determinism, canvas-runtime, png-encoding-runtime, move generation outside-next-app-shell while presenting static artifacts in the existing-next-react-typescript-app',
		)
	})
})
