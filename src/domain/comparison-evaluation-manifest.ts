import type { OfficialArtifactMatrixEntry, OfficialFixtureKey } from './artifact-matrix'
import type { CameraDirectionPresetKey, CameraElevationPresetKey, OutputSizePresetKey } from './camera-output-preset'
import type { OfficialRendererVariantKey } from './renderer-variant'

import { assert } from '../utils/error'
import { OFFICIAL_ARTIFACT_MATRIX, OFFICIAL_FIXTURE_KEYS, officialArtifactName } from './artifact-matrix'
import {
	assertOfficialCameraOutputPresetSelection,
	OFFICIAL_CAMERA_DIRECTION_PRESETS,
	OFFICIAL_CAMERA_ELEVATION_PRESETS,
	OFFICIAL_OUTPUT_SIZE_PRESETS,
} from './camera-output-preset'
import { BLIND_EVALUATION_RENDERER_VARIANT_KEYS } from './renderer-variant'

export type ComparisonManifestEntry = OfficialArtifactMatrixEntry & {
	outputPurpose: 'primary-game-scale-acceptance' | 'diagnostic-detail-inspection'
}

export type BlindEvaluationLabel = 'A' | 'B' | 'C'

export type BlindEvaluationStimulusSet = {
	blindLabel: BlindEvaluationLabel
	renderer: OfficialRendererVariantKey
	artifacts: ReadonlyArray<Pick<OfficialArtifactMatrixEntry, 'direction' | 'artifactName'>>
}

export type BlindEvaluationTrial = {
	fixture: OfficialFixtureKey
	elevation: CameraElevationPresetKey
	outputSize: 64
	directions: ReadonlyArray<CameraDirectionPresetKey>
	stimulusSets: ReadonlyArray<BlindEvaluationStimulusSet>
}

export const PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE = 64 satisfies OutputSizePresetKey
export const DIAGNOSTIC_DETAIL_OUTPUT_SIZE = 128 satisfies OutputSizePresetKey

const COMPARISON_MANIFEST_ENTRY_KEYS = new Set(['fixture', 'renderer', 'elevation', 'outputSize', 'direction', 'artifactName', 'outputPurpose'])
const BLIND_EVALUATION_TRIAL_KEYS = new Set(['fixture', 'elevation', 'outputSize', 'directions', 'stimulusSets'])
const OFFICIAL_FIXTURE_KEY_SET: ReadonlySet<unknown> = new Set(OFFICIAL_FIXTURE_KEYS)
const OFFICIAL_RENDERER_KEY_SET: ReadonlySet<unknown> = new Set(BLIND_EVALUATION_RENDERER_VARIANT_KEYS)
const OFFICIAL_ELEVATION_KEY_SET: ReadonlySet<unknown> = new Set(OFFICIAL_CAMERA_ELEVATION_PRESETS.map((preset) => preset.key))
const OFFICIAL_DIRECTION_KEYS = OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key)
const BLIND_LABELS = ['A', 'B', 'C'] as const satisfies ReadonlyArray<BlindEvaluationLabel>

export const OFFICIAL_COMPARISON_MANIFEST = OFFICIAL_ARTIFACT_MATRIX.map((entry) => {
	return comparisonManifestEntry(entry)
}) satisfies ReadonlyArray<ComparisonManifestEntry>

export const OFFICIAL_BLIND_EVALUATION_TRIALS = OFFICIAL_FIXTURE_KEYS.flatMap((fixture) => {
	return OFFICIAL_CAMERA_ELEVATION_PRESETS.map((elevation) => blindEvaluationTrial(fixture, elevation.key))
}) satisfies ReadonlyArray<BlindEvaluationTrial>

export function assertOfficialComparisonManifestEntry(value: unknown): asserts value is ComparisonManifestEntry {
	assert(isRecord(value), 'Comparison manifest entries must use official preset metadata')
	assert(Object.keys(value).every((key) => COMPARISON_MANIFEST_ENTRY_KEYS.has(key)), 'Comparison manifest entries must use official preset metadata')
	assert(isOfficialFixtureKey(value.fixture), 'Comparison manifest entries must use official preset metadata')
	assert(isOfficialRendererVariantKey(value.renderer), 'Comparison manifest entries must use official preset metadata')
	assert(value.outputPurpose === outputPurpose(value.outputSize as OutputSizePresetKey), 'Comparison manifest entries must use official preset metadata')
	const cameraOutputSelection = { direction: value.direction, elevation: value.elevation, outputSize: value.outputSize }
	assertOfficialCameraOutputPresetSelection(cameraOutputSelection)
	assert(value.artifactName === officialArtifactName({
		fixture: value.fixture,
		renderer: value.renderer,
		...cameraOutputSelection,
	}), 'Comparison manifest entries must use official preset metadata')
}

export function assertOfficialBlindEvaluationTrial(value: unknown): asserts value is BlindEvaluationTrial {
	assert(isRecord(value), 'Blind evaluation trials must use official primary preset metadata')
	assert(Object.keys(value).every((key) => BLIND_EVALUATION_TRIAL_KEYS.has(key)), 'Blind evaluation trials must use official primary preset metadata')
	assert(isOfficialFixtureKey(value.fixture), 'Blind evaluation trials must use official primary preset metadata')
	assert(value.outputSize === PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE, 'Blind evaluation trials must use official primary preset metadata')
	assert(isOfficialElevation(value.elevation), 'Blind evaluation trials must use official primary preset metadata')
	assertOfficialDirections(value.directions)
	assertOfficialStimulusSets(value)
}

function comparisonManifestEntry(entry: OfficialArtifactMatrixEntry): ComparisonManifestEntry {
	return {
		...entry,
		outputPurpose: outputPurpose(entry.outputSize),
	}
}

function blindEvaluationTrial(fixture: OfficialFixtureKey, elevation: CameraElevationPresetKey): BlindEvaluationTrial {
	return {
		fixture,
		elevation,
		outputSize: PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE,
		directions: OFFICIAL_DIRECTION_KEYS,
		stimulusSets: BLIND_EVALUATION_RENDERER_VARIANT_KEYS.map((renderer, index) => ({
			blindLabel: BLIND_LABELS[index],
			renderer,
			artifacts: OFFICIAL_DIRECTION_KEYS.map((direction) => ({
				direction,
				artifactName: officialArtifactName({
					fixture,
					renderer,
					elevation,
					outputSize: PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE,
					direction,
				}),
			})),
		})),
	}
}

function outputPurpose(outputSize: OutputSizePresetKey): ComparisonManifestEntry['outputPurpose'] {
	const outputSizePreset = OFFICIAL_OUTPUT_SIZE_PRESETS.find((preset) => preset.key === outputSize)
	assert(outputSizePreset !== undefined, 'Output size must be an official preset')
	return outputSizePreset.purpose
}

function assertOfficialDirections(value: unknown): asserts value is ReadonlyArray<CameraDirectionPresetKey> {
	assert(Array.isArray(value), 'Blind evaluation trials must use official primary preset metadata')
	assert(value.length === OFFICIAL_DIRECTION_KEYS.length, 'Blind evaluation trials must use official primary preset metadata')
	assert(value.every((direction, index) => direction === OFFICIAL_DIRECTION_KEYS[index]), 'Blind evaluation trials must use official primary preset metadata')
}

function assertOfficialStimulusSets(trial: Record<string, unknown>): void {
	assert(Array.isArray(trial.stimulusSets), 'Blind evaluation trials must use official primary preset metadata')
	assert(trial.stimulusSets.length === BLIND_EVALUATION_RENDERER_VARIANT_KEYS.length, 'Blind evaluation trials must use official primary preset metadata')

	for (const [index, stimulusSet] of trial.stimulusSets.entries()) {
		assert(isRecord(stimulusSet), 'Blind evaluation trials must use official primary preset metadata')
		assert(stimulusSet.blindLabel === BLIND_LABELS[index], 'Blind evaluation trials must use official primary preset metadata')
		assert(stimulusSet.renderer === BLIND_EVALUATION_RENDERER_VARIANT_KEYS[index], 'Blind evaluation trials must use official primary preset metadata')
		assertOfficialStimulusArtifacts(stimulusSet, trial.fixture, trial.elevation)
	}
}

function assertOfficialStimulusArtifacts(stimulusSet: Record<string, unknown>, fixture: unknown, elevation: unknown): void {
	assert(Array.isArray(stimulusSet.artifacts), 'Blind evaluation trials must use official primary preset metadata')
	assert(stimulusSet.artifacts.length === OFFICIAL_DIRECTION_KEYS.length, 'Blind evaluation trials must use official primary preset metadata')

	for (const [index, artifact] of stimulusSet.artifacts.entries()) {
		assert(isRecord(artifact), 'Blind evaluation trials must use official primary preset metadata')
		assert(artifact.direction === OFFICIAL_DIRECTION_KEYS[index], 'Blind evaluation trials must use official primary preset metadata')
		assert(artifact.artifactName === officialArtifactName({
			fixture: fixture as OfficialFixtureKey,
			renderer: stimulusSet.renderer as OfficialRendererVariantKey,
			elevation: elevation as CameraElevationPresetKey,
			outputSize: PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE,
			direction: artifact.direction as CameraDirectionPresetKey,
		}), 'Blind evaluation trials must use official primary preset metadata')
	}
}

function isOfficialFixtureKey(value: unknown): value is OfficialFixtureKey {
	return OFFICIAL_FIXTURE_KEY_SET.has(value)
}

function isOfficialRendererVariantKey(value: unknown): value is OfficialRendererVariantKey {
	return OFFICIAL_RENDERER_KEY_SET.has(value)
}

function isOfficialElevation(value: unknown): value is CameraElevationPresetKey {
	return OFFICIAL_ELEVATION_KEY_SET.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
