export type PrototypeHostDecision = {
	phase: 'phase-0'
	comparisonPageHost: 'existing-next-react-typescript-app'
	purpose: 'blind-comparison-evidence-collection'
	rendererGenerationLocation: 'separable-non-ui-seam'
	generationEscapeHatch: {
		triggerConstraints: ReadonlyArray<'pixel-level-determinism' | 'canvas-runtime' | 'png-encoding-runtime'>
		fallbackGenerationHost: 'outside-next-app-shell'
		defaultStaticPresentationHost: 'existing-next-react-typescript-app'
	}
	finalMvpEditorArchitectureCommitment: false
	notes: ReadonlyArray<string>
}

export const PHASE_0_PROTOTYPE_HOST_DECISION: PrototypeHostDecision = {
	phase: 'phase-0',
	comparisonPageHost: 'existing-next-react-typescript-app',
	purpose: 'blind-comparison-evidence-collection',
	rendererGenerationLocation: 'separable-non-ui-seam',
	generationEscapeHatch: {
		triggerConstraints: ['pixel-level-determinism', 'canvas-runtime', 'png-encoding-runtime'],
		fallbackGenerationHost: 'outside-next-app-shell',
		defaultStaticPresentationHost: 'existing-next-react-typescript-app',
	},
	finalMvpEditorArchitectureCommitment: false,
	notes: [
		'The existing Next/React/TypeScript app is the default host for the Phase 0 comparison page.',
		'This host choice is limited to collecting Phase 0 comparison evidence.',
		'This decision does not commit the project to the final MVP editor architecture.',
		'Deterministic PNG artifact generation may move outside the Next app shell if pixel-level, canvas, or PNG encoding constraints require it.',
		'Next remains the default host for static artifact presentation unless static presentation also becomes impractical.',
	],
}

export function phase0ComparisonHostSummary(decision: PrototypeHostDecision = PHASE_0_PROTOTYPE_HOST_DECISION): string {
	return `${decision.phase}: use the ${decision.comparisonPageHost} for ${decision.purpose}; final MVP editor architecture committed: ${decision.finalMvpEditorArchitectureCommitment}`
}

export function phase0RenderingEscapeHatchSummary(decision: PrototypeHostDecision = PHASE_0_PROTOTYPE_HOST_DECISION): string {
	return `rendering: ${decision.rendererGenerationLocation}; if constrained by ${decision.generationEscapeHatch.triggerConstraints.join(', ')}, move generation ${decision.generationEscapeHatch.fallbackGenerationHost} while presenting static artifacts in the ${decision.generationEscapeHatch.defaultStaticPresentationHost}`
}
