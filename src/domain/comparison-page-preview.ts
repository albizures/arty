import type { BlindComparisonTrial } from './comparison-evaluation-manifest'

export type ComparisonPreviewMode = 'actual-size' | 'nearest-neighbor-enlarged'
export type ComparisonInspectionBackground = 'transparent' | 'checkerboard' | 'dark'
export type Phase0ComparisonPageFeature
	= | 'checkerboard-background-inspection'
		| 'voxel-editing'
		| 'renderer-controls'
		| 'manual-2d-correction-tools'
		| 'account-session-systems'
		| 'product-grade-navigation'
		| 'generalized-asset-browsing'

export type ComparisonInspectionBackgroundStyle = {
	backgroundColor: string
	backgroundImage?: string
	backgroundPosition?: string
	backgroundSize?: string
}

export type Phase0ComparisonPageScopeDecision = {
	accepted: boolean
	reason: string
}

export const COMPARISON_INSPECTION_BACKGROUND_OPTIONS: ReadonlyArray<ComparisonInspectionBackground> = ['transparent', 'checkerboard', 'dark']

const PHASE_0_COMPARISON_PAGE_ALLOWED_FEATURES = new Set<Phase0ComparisonPageFeature>(['checkerboard-background-inspection'])

export type ComparisonPreviewImage = {
	mode: ComparisonPreviewMode
	scale: 1 | 2 | 4
	width: number
	height: number
	imageRendering: 'auto' | 'pixelated'
	artifactName: string
	artifactPath: string
}

export type ComparisonPageArtifactPreview = {
	direction: string
	actualSize: ComparisonPreviewImage
	enlarged: ComparisonPreviewImage
}

export type ComparisonPageStimulusPreview = {
	blindLabel: string
	artifacts: ReadonlyArray<ComparisonPageArtifactPreview>
}

export type ComparisonPageTrialPreview = {
	trialId: string
	context: {
		fixture: string
		elevation: string
		outputSize: number
		directions: ReadonlyArray<string>
	}
	stimulusSets: ReadonlyArray<ComparisonPageStimulusPreview>
}

export function comparisonPageTrialPreview(
	trial: BlindComparisonTrial,
	options: { artifactBasePath: string },
): ComparisonPageTrialPreview {
	const enlargedScale = nearestNeighborEnlargementScale(trial.outputSize)

	return {
		trialId: trial.trialId,
		context: {
			fixture: trial.fixture,
			elevation: trial.elevation,
			outputSize: trial.outputSize,
			directions: trial.directions,
		},
		stimulusSets: trial.stimulusSets.map((stimulusSet) => ({
			blindLabel: stimulusSet.blindLabel,
			artifacts: stimulusSet.artifacts.map((artifact) => ({
				direction: artifact.direction,
				actualSize: previewImage({
					artifactName: artifact.artifactName,
					artifactBasePath: options.artifactBasePath,
					mode: 'actual-size',
					sourceSize: trial.outputSize,
					scale: 1,
				}),
				enlarged: previewImage({
					artifactName: artifact.artifactName,
					artifactBasePath: options.artifactBasePath,
					mode: 'nearest-neighbor-enlarged',
					sourceSize: trial.outputSize,
					scale: enlargedScale,
				}),
			})),
		})),
	}
}

export function nearestNeighborEnlargementScale(outputSize: number): 2 | 4 {
	if (outputSize === 64) {
		return 4
	}
	if (outputSize === 128) {
		return 2
	}
	throw new Error(`Unsupported comparison preview output size: ${outputSize}`)
}

export function comparisonInspectionBackgroundStyle(background: ComparisonInspectionBackground): ComparisonInspectionBackgroundStyle {
	if (background === 'transparent') {
		return { backgroundColor: 'transparent' }
	}
	if (background === 'dark') {
		return { backgroundColor: '#202020' }
	}
	return {
		backgroundColor: '#ffffff',
		backgroundImage: 'linear-gradient(45deg, #c8c8c8 25%, transparent 25%), linear-gradient(-45deg, #c8c8c8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #c8c8c8 75%), linear-gradient(-45deg, transparent 75%, #c8c8c8 75%)',
		backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
		backgroundSize: '16px 16px',
	}
}

export function phase0ComparisonPageScopeDecision(feature: Phase0ComparisonPageFeature): Phase0ComparisonPageScopeDecision {
	if (PHASE_0_COMPARISON_PAGE_ALLOWED_FEATURES.has(feature)) {
		return {
			accepted: true,
			reason: 'Phase 0 comparison page evidence review.',
		}
	}
	return {
		accepted: false,
		reason: `${feature} is out of scope for the Phase 0 comparison page.`,
	}
}

function previewImage(input: {
	artifactName: string
	artifactBasePath: string
	mode: ComparisonPreviewMode
	sourceSize: number
	scale: 1 | 2 | 4
}): ComparisonPreviewImage {
	return {
		mode: input.mode,
		scale: input.scale,
		width: input.sourceSize * input.scale,
		height: input.sourceSize * input.scale,
		imageRendering: input.scale === 1 ? 'auto' : 'pixelated',
		artifactName: input.artifactName,
		artifactPath: `${input.artifactBasePath.replace(/\/$/, '')}/${input.artifactName}`,
	}
}
