import type { BlindComparisonTrial } from './comparison-evaluation-manifest'

import { OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'

export type ComparisonArtifactManifest = {
	artifactBasePath: string
	trials: ReadonlyArray<BlindComparisonTrial>
	generatedBy: 'non-ui-artifact-generation-seam'
	artifactSource: 'static-generated-png-files'
	compatibleGenerationHosts: ReadonlyArray<'typescript-module' | 'standalone-node-cli' | 'external-rendering-pipeline'>
	consumedBy: 'comparison-page-presentation-only'
	requiresNextRendering: false
	containsPixelData: false
	containsRendererControls: false
}

export const PHASE_0_COMPARISON_ARTIFACT_MANIFEST: ComparisonArtifactManifest = {
	artifactBasePath: '/phase-0/blind-artifacts',
	trials: OFFICIAL_BLIND_COMPARISON_TRIALS,
	generatedBy: 'non-ui-artifact-generation-seam',
	artifactSource: 'static-generated-png-files',
	compatibleGenerationHosts: ['typescript-module', 'standalone-node-cli', 'external-rendering-pipeline'],
	consumedBy: 'comparison-page-presentation-only',
	requiresNextRendering: false,
	containsPixelData: false,
	containsRendererControls: false,
}

export function fixedPhase0ComparisonTrial(
	manifest: ComparisonArtifactManifest = PHASE_0_COMPARISON_ARTIFACT_MANIFEST,
): BlindComparisonTrial {
	const trial = manifest.trials[0]
	if (trial === undefined) {
		throw new Error('Comparison artifact manifest must contain at least one trial.')
	}
	return trial
}
