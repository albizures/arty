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

export type BlindComparisonLabel = 'A' | 'B' | 'C'

export type BlindComparisonStimulusSet = {
	blindLabel: BlindComparisonLabel
	artifacts: ReadonlyArray<Pick<OfficialArtifactMatrixEntry, 'direction' | 'artifactName'>>
}

export type BlindComparisonTrial = {
	trialId: string
	fixture: OfficialFixtureKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	directions: ReadonlyArray<CameraDirectionPresetKey>
	stimulusSets: ReadonlyArray<BlindComparisonStimulusSet>
}

export type BlindComparisonAnswerKey = {
	trialId: string
	assignments: ReadonlyArray<{
		blindLabel: BlindComparisonLabel
		renderer: OfficialRendererVariantKey
		sourceArtifactNames: ReadonlyArray<string>
	}>
}

export type BlindComparisonTrials = {
	trials: ReadonlyArray<BlindComparisonTrial>
	answerKey: ReadonlyArray<BlindComparisonAnswerKey>
}

export const PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE = 64 satisfies OutputSizePresetKey
export const DIAGNOSTIC_DETAIL_OUTPUT_SIZE = 128 satisfies OutputSizePresetKey

const COMPARISON_MANIFEST_ENTRY_KEYS = new Set(['fixture', 'renderer', 'elevation', 'outputSize', 'direction', 'artifactName', 'outputPurpose'])
const BLIND_COMPARISON_TRIAL_KEYS = new Set(['trialId', 'fixture', 'elevation', 'outputSize', 'directions', 'stimulusSets'])
const BLIND_COMPARISON_STIMULUS_SET_KEYS = new Set(['blindLabel', 'artifacts'])
const BLIND_COMPARISON_ARTIFACT_KEYS = new Set(['direction', 'artifactName'])
const OFFICIAL_FIXTURE_KEY_SET: ReadonlySet<unknown> = new Set(OFFICIAL_FIXTURE_KEYS)
const OFFICIAL_RENDERER_KEY_SET: ReadonlySet<unknown> = new Set(BLIND_EVALUATION_RENDERER_VARIANT_KEYS)
const OFFICIAL_ELEVATION_KEY_SET: ReadonlySet<unknown> = new Set(OFFICIAL_CAMERA_ELEVATION_PRESETS.map((preset) => preset.key))
const OFFICIAL_OUTPUT_SIZE_KEY_SET: ReadonlySet<unknown> = new Set(OFFICIAL_OUTPUT_SIZE_PRESETS.map((preset) => preset.key))
const OFFICIAL_DIRECTION_KEYS = OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key)
const BLIND_LABELS = ['A', 'B', 'C'] as const satisfies ReadonlyArray<BlindComparisonLabel>

export const OFFICIAL_COMPARISON_MANIFEST = OFFICIAL_ARTIFACT_MATRIX.map((entry) => {
	return comparisonManifestEntry(entry)
}) satisfies ReadonlyArray<ComparisonManifestEntry>

const OFFICIAL_BLIND_COMPARISON = createBlindComparisonTrials(OFFICIAL_ARTIFACT_MATRIX)

export const OFFICIAL_BLIND_COMPARISON_TRIALS = OFFICIAL_BLIND_COMPARISON.trials
export const OFFICIAL_BLIND_COMPARISON_ANSWER_KEY = OFFICIAL_BLIND_COMPARISON.answerKey

export function createBlindComparisonTrials(artifacts: ReadonlyArray<OfficialArtifactMatrixEntry>): BlindComparisonTrials {
	const trials: Array<BlindComparisonTrial> = []
	const answerKey: Array<BlindComparisonAnswerKey> = []

	for (const fixture of OFFICIAL_FIXTURE_KEYS) {
		for (const elevationPreset of OFFICIAL_CAMERA_ELEVATION_PRESETS) {
			for (const outputSizePreset of OFFICIAL_OUTPUT_SIZE_PRESETS) {
				const trialId = `${fixture}__${elevationPreset.key}__${outputSizePreset.key}`
				const assignments = shuffledRenderers(trialId).map((renderer, index) => {
					const blindLabel = requireBlindLabel(index)
					const sourceArtifacts = OFFICIAL_DIRECTION_KEYS.map((direction) => requireArtifact(artifacts, {
						fixture,
						renderer,
						elevation: elevationPreset.key,
						outputSize: outputSizePreset.key,
						direction,
					}))

					return {
						blindLabel,
						renderer,
						sourceArtifacts,
					}
				})

				trials.push({
					trialId,
					fixture,
					elevation: elevationPreset.key,
					outputSize: outputSizePreset.key,
					directions: OFFICIAL_DIRECTION_KEYS,
					stimulusSets: assignments.map((assignment) => ({
						blindLabel: assignment.blindLabel,
						artifacts: assignment.sourceArtifacts.map((artifact) => ({
							direction: artifact.direction,
							artifactName: anonymizedArtifactName({
								fixture,
								elevation: elevationPreset.key,
								outputSize: outputSizePreset.key,
								blindLabel: assignment.blindLabel,
								direction: artifact.direction,
							}),
						})),
					})),
				})

				answerKey.push({
					trialId,
					assignments: assignments.map((assignment) => ({
						blindLabel: assignment.blindLabel,
						renderer: assignment.renderer,
						sourceArtifactNames: assignment.sourceArtifacts.map((artifact) => artifact.artifactName),
					})),
				})
			}
		}
	}

	return { trials, answerKey }
}

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

export function assertOfficialBlindComparisonTrial(value: unknown): asserts value is BlindComparisonTrial {
	assert(isRecord(value), 'Blind comparison trials must use anonymized official preset metadata')
	assert(Object.keys(value).every((key) => BLIND_COMPARISON_TRIAL_KEYS.has(key)), 'Blind comparison trials must use anonymized official preset metadata')
	assert(isOfficialFixtureKey(value.fixture), 'Blind comparison trials must use anonymized official preset metadata')
	assert(isOfficialElevation(value.elevation), 'Blind comparison trials must use anonymized official preset metadata')
	assert(isOfficialOutputSize(value.outputSize), 'Blind comparison trials must use anonymized official preset metadata')
	assert(value.trialId === `${value.fixture}__${value.elevation}__${value.outputSize}`, 'Blind comparison trials must use anonymized official preset metadata')
	assertOfficialDirections(value.directions)
	assertOfficialStimulusSets(value)
}

function comparisonManifestEntry(entry: OfficialArtifactMatrixEntry): ComparisonManifestEntry {
	return {
		...entry,
		outputPurpose: outputPurpose(entry.outputSize),
	}
}

function outputPurpose(outputSize: OutputSizePresetKey): ComparisonManifestEntry['outputPurpose'] {
	const outputSizePreset = OFFICIAL_OUTPUT_SIZE_PRESETS.find((preset) => preset.key === outputSize)
	assert(outputSizePreset !== undefined, 'Output size must be an official preset')
	return outputSizePreset.purpose
}

function requireArtifact(
	artifacts: ReadonlyArray<OfficialArtifactMatrixEntry>,
	selection: Omit<OfficialArtifactMatrixEntry, 'artifactName'>,
): OfficialArtifactMatrixEntry {
	const expectedArtifactName = officialArtifactName(selection)
	const artifact = artifacts.find((candidate) => candidate.artifactName === expectedArtifactName)
	if (artifact === undefined) {
		throw new Error(`Missing official artifact '${expectedArtifactName}' for blind comparison trial.`)
	}
	return artifact
}

function anonymizedArtifactName(selection: {
	fixture: OfficialFixtureKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	blindLabel: BlindComparisonLabel
	direction: CameraDirectionPresetKey
}): string {
	return `${selection.fixture}__${selection.elevation}__${selection.outputSize}__${selection.blindLabel}__${selection.direction}.png`
}

function shuffledRenderers(trialId: string): ReadonlyArray<OfficialRendererVariantKey> {
	return [...BLIND_EVALUATION_RENDERER_VARIANT_KEYS].sort((left, right) => {
		return stableHash(`${trialId}:${left}`) - stableHash(`${trialId}:${right}`)
	})
}

function stableHash(value: string): number {
	let hash = 0
	for (let index = 0; index < value.length; index += 1) {
		hash = ((hash * 31) + value.charCodeAt(index)) >>> 0
	}
	return hash
}

function requireBlindLabel(index: number): BlindComparisonLabel {
	return BLIND_LABELS[index] as BlindComparisonLabel
}

function assertOfficialDirections(value: unknown): asserts value is ReadonlyArray<CameraDirectionPresetKey> {
	assert(Array.isArray(value), 'Blind comparison trials must use anonymized official preset metadata')
	assert(value.length === OFFICIAL_DIRECTION_KEYS.length, 'Blind comparison trials must use anonymized official preset metadata')
	assert(value.every((direction, index) => direction === OFFICIAL_DIRECTION_KEYS[index]), 'Blind comparison trials must use anonymized official preset metadata')
}

function assertOfficialStimulusSets(trial: Record<string, unknown>): void {
	assert(Array.isArray(trial.stimulusSets), 'Blind comparison trials must use anonymized official preset metadata')
	assert(trial.stimulusSets.length === BLIND_EVALUATION_RENDERER_VARIANT_KEYS.length, 'Blind comparison trials must use anonymized official preset metadata')

	for (const [index, stimulusSet] of trial.stimulusSets.entries()) {
		const blindLabel = requireBlindLabel(index)
		assert(isRecord(stimulusSet), 'Blind comparison trials must use anonymized official preset metadata')
		assert(Object.keys(stimulusSet).every((key) => BLIND_COMPARISON_STIMULUS_SET_KEYS.has(key)), 'Blind comparison trials must use anonymized official preset metadata')
		assert(stimulusSet.blindLabel === blindLabel, 'Blind comparison trials must use anonymized official preset metadata')
		assertOfficialStimulusArtifacts(stimulusSet, trial.fixture, trial.elevation, trial.outputSize, blindLabel)
	}
}

function assertOfficialStimulusArtifacts(
	stimulusSet: Record<string, unknown>,
	fixture: unknown,
	elevation: unknown,
	outputSize: unknown,
	blindLabel: BlindComparisonLabel,
): void {
	assert(Array.isArray(stimulusSet.artifacts), 'Blind comparison trials must use anonymized official preset metadata')
	assert(stimulusSet.artifacts.length === OFFICIAL_DIRECTION_KEYS.length, 'Blind comparison trials must use anonymized official preset metadata')

	for (const [index, artifact] of stimulusSet.artifacts.entries()) {
		assert(isRecord(artifact), 'Blind comparison trials must use anonymized official preset metadata')
		assert(Object.keys(artifact).every((key) => BLIND_COMPARISON_ARTIFACT_KEYS.has(key)), 'Blind comparison trials must use anonymized official preset metadata')
		assert(artifact.direction === OFFICIAL_DIRECTION_KEYS[index], 'Blind comparison trials must use anonymized official preset metadata')
		assert(artifact.artifactName === anonymizedArtifactName({
			fixture: fixture as OfficialFixtureKey,
			elevation: elevation as CameraElevationPresetKey,
			outputSize: outputSize as OutputSizePresetKey,
			blindLabel,
			direction: artifact.direction as CameraDirectionPresetKey,
		}), 'Blind comparison trials must use anonymized official preset metadata')
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

function isOfficialOutputSize(value: unknown): value is OutputSizePresetKey {
	return OFFICIAL_OUTPUT_SIZE_KEY_SET.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
