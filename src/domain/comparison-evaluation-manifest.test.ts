import { describe, expect, it } from 'vitest'

import {
	OFFICIAL_ARTIFACT_MATRIX,
	OFFICIAL_FIXTURE_KEYS,
	officialArtifactName,
} from './artifact-matrix'
import { OFFICIAL_CAMERA_DIRECTION_PRESETS, OFFICIAL_CAMERA_ELEVATION_PRESETS } from './camera-output-preset'
import {
	assertOfficialBlindEvaluationTrial,
	assertOfficialComparisonManifestEntry,
	DIAGNOSTIC_DETAIL_OUTPUT_SIZE,
	OFFICIAL_BLIND_EVALUATION_TRIALS,
	OFFICIAL_COMPARISON_MANIFEST,
	PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE,
} from './comparison-evaluation-manifest'
import { BLIND_EVALUATION_RENDERER_VARIANT_KEYS } from './renderer-variant'

describe('comparison and evaluation preset manifests', () => {
	it('shares official camera/output preset metadata with the comparison manifest', () => {
		expect(OFFICIAL_COMPARISON_MANIFEST).toHaveLength(OFFICIAL_ARTIFACT_MATRIX.length)
		expect(OFFICIAL_COMPARISON_MANIFEST[0]).toEqual({
			fixture: 'chest',
			renderer: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE,
			artifactName: 'chest__baseline__elev26__64__front-right.png',
			outputPurpose: 'primary-game-scale-acceptance',
		})
		expect(OFFICIAL_COMPARISON_MANIFEST[1]).toMatchObject({
			outputSize: DIAGNOSTIC_DETAIL_OUTPUT_SIZE,
			outputPurpose: 'diagnostic-detail-inspection',
		})

		for (const entry of OFFICIAL_COMPARISON_MANIFEST) {
			expect(() => assertOfficialComparisonManifestEntry(entry)).not.toThrow()
		}
	})

	it('builds primary blind-evaluation trials for every fixture and elevation', () => {
		expect(OFFICIAL_BLIND_EVALUATION_TRIALS).toHaveLength(
			OFFICIAL_FIXTURE_KEYS.length * OFFICIAL_CAMERA_ELEVATION_PRESETS.length,
		)

		expect(OFFICIAL_BLIND_EVALUATION_TRIALS.map((trial) => `${trial.fixture}:${trial.elevation}`)).toEqual([
			'chest:elev26',
			'chest:elev35',
			'chair:elev26',
			'chair:elev35',
			'lantern:elev26',
			'lantern:elev35',
			'generator:elev26',
			'generator:elev35',
			'rover:elev26',
			'rover:elev35',
		])
	})

	it('groups all four directions together for each fixture/elevation trial at 64 output size', () => {
		const officialDirections = OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key)

		for (const trial of OFFICIAL_BLIND_EVALUATION_TRIALS) {
			expect(trial.outputSize).toBe(PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE)
			expect(trial.directions).toEqual(officialDirections)
			expect(trial.stimulusSets).toHaveLength(BLIND_EVALUATION_RENDERER_VARIANT_KEYS.length)

			for (const [variantIndex, stimulusSet] of trial.stimulusSets.entries()) {
				expect(stimulusSet.blindLabel).toBe(['A', 'B', 'C'][variantIndex])
				expect(stimulusSet.renderer).toBe(BLIND_EVALUATION_RENDERER_VARIANT_KEYS[variantIndex])
				expect(stimulusSet.artifacts).toEqual(officialDirections.map((direction) => ({
					direction,
					artifactName: officialArtifactName({
						fixture: trial.fixture,
						renderer: stimulusSet.renderer,
						elevation: trial.elevation,
						outputSize: PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE,
						direction,
					}),
				})))
			}
		}
	})

	it('keeps 128 output diagnostic instead of official blind stimulus', () => {
		expect(OFFICIAL_COMPARISON_MANIFEST.some((entry) => entry.outputSize === DIAGNOSTIC_DETAIL_OUTPUT_SIZE)).toBe(true)
		expect(OFFICIAL_BLIND_EVALUATION_TRIALS.every((trial) => trial.outputSize === PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE)).toBe(true)
		expect(OFFICIAL_BLIND_EVALUATION_TRIALS.flatMap((trial) => {
			return trial.stimulusSets.flatMap((stimulusSet) => stimulusSet.artifacts.map((artifact) => artifact.artifactName))
		}).every((artifactName) => artifactName.includes('__64__'))).toBe(true)
	})

	it('accepts official blind-evaluation trials', () => {
		for (const trial of OFFICIAL_BLIND_EVALUATION_TRIALS) {
			expect(() => assertOfficialBlindEvaluationTrial(trial)).not.toThrow()
		}
	})

	it('rejects arbitrary camera and output configuration in manifest consumers', () => {
		expect(() => assertOfficialComparisonManifestEntry({
			...OFFICIAL_COMPARISON_MANIFEST[0],
			angle: 45,
		})).toThrowError('Comparison manifest entries must use official preset metadata')
		expect(() => assertOfficialComparisonManifestEntry({
			...OFFICIAL_COMPARISON_MANIFEST[0],
			direction: 'side',
		})).toThrowError('Phase 0 camera/output must use an official named preset selection')
		expect(() => assertOfficialComparisonManifestEntry({
			...OFFICIAL_COMPARISON_MANIFEST[0],
			outputSize: 96,
		})).toThrowError('Output size must be an official preset')
		expect(() => assertOfficialBlindEvaluationTrial({
			...OFFICIAL_BLIND_EVALUATION_TRIALS[0],
			canvasSize: { width: 64, height: 64 },
		})).toThrowError('Blind evaluation trials must use official primary preset metadata')
		expect(() => assertOfficialBlindEvaluationTrial({
			...OFFICIAL_BLIND_EVALUATION_TRIALS[0],
			outputSize: DIAGNOSTIC_DETAIL_OUTPUT_SIZE,
		})).toThrowError('Blind evaluation trials must use official primary preset metadata')
	})

	it('rejects comparison entries whose fixture, renderer, or artifact name are not official', () => {
		const entry = OFFICIAL_COMPARISON_MANIFEST[0]

		expect(() => assertOfficialComparisonManifestEntry(null)).toThrowError('Comparison manifest entries must use official preset metadata')
		expect(() => assertOfficialComparisonManifestEntry(undefined)).toThrowError('Comparison manifest entries must use official preset metadata')
		expect(() => assertOfficialComparisonManifestEntry({
			...entry,
			fixture: 'spaceship',
			artifactName: 'spaceship__baseline__elev26__64__front-right.png',
		})).toThrowError('Comparison manifest entries must use official preset metadata')
		expect(() => assertOfficialComparisonManifestEntry({
			...entry,
			renderer: 'debug',
			artifactName: 'chest__debug__elev26__64__front-right.png',
		})).toThrowError('Comparison manifest entries must use official preset metadata')
		expect(() => assertOfficialComparisonManifestEntry({
			...entry,
			artifactName: 'renamed.png',
		})).toThrowError('Comparison manifest entries must use official preset metadata')
	})

	it('rejects malformed blind-evaluation trial metadata', () => {
		const trial = OFFICIAL_BLIND_EVALUATION_TRIALS[0]
		const directionsArrayLike = {
			length: OFFICIAL_CAMERA_DIRECTION_PRESETS.length,
			every: () => true,
		}
		const stimulusSetsArrayLike = {
			length: BLIND_EVALUATION_RENDERER_VARIANT_KEYS.length,
			* entries() {
				yield* trial.stimulusSets.entries()
			},
		}
		const artifactsArrayLike = {
			length: OFFICIAL_CAMERA_DIRECTION_PRESETS.length,
			* entries() {
				yield* trial.stimulusSets[0].artifacts.entries()
			},
		}
		const invalidFixtureTrial = {
			...trial,
			fixture: 'spaceship',
			stimulusSets: trial.stimulusSets.map((stimulusSet) => ({
				...stimulusSet,
				artifacts: stimulusSet.artifacts.map((artifact) => ({
					...artifact,
					artifactName: `spaceship__${stimulusSet.renderer}__${trial.elevation}__64__${artifact.direction}.png`,
				})),
			})),
		}
		const invalidElevationTrial = {
			...trial,
			elevation: 'elev45',
			stimulusSets: trial.stimulusSets.map((stimulusSet) => ({
				...stimulusSet,
				artifacts: stimulusSet.artifacts.map((artifact) => ({
					...artifact,
					artifactName: `${trial.fixture}__${stimulusSet.renderer}__elev45__64__${artifact.direction}.png`,
				})),
			})),
		}
		const invalidRendererTrial = {
			...trial,
			stimulusSets: [{
				...trial.stimulusSets[0],
				renderer: 'debug',
				artifacts: trial.stimulusSets[0].artifacts.map((artifact) => ({
					...artifact,
					artifactName: `${trial.fixture}__debug__${trial.elevation}__64__${artifact.direction}.png`,
				})),
			}, ...trial.stimulusSets.slice(1)],
		}
		const invalidArtifactDirectionTrial = {
			...trial,
			stimulusSets: [{
				...trial.stimulusSets[0],
				artifacts: [{
					...trial.stimulusSets[0].artifacts[0],
					direction: 'side',
					artifactName: `${trial.fixture}__${trial.stimulusSets[0].renderer}__${trial.elevation}__64__side.png`,
				}, ...trial.stimulusSets[0].artifacts.slice(1)],
			}, ...trial.stimulusSets.slice(1)],
		}
		const malformedTrials = [
			null,
			[],
			undefined,
			{ ...trial, fixture: 'spaceship' },
			invalidFixtureTrial,
			{ ...trial, elevation: 35 },
			invalidElevationTrial,
			{ ...trial, directions: 'front-right' },
			{ ...trial, directions: directionsArrayLike },
			{ ...trial, directions: ['front-right'] },
			{ ...trial, directions: ['front-left', 'back-right', 'back-left', 'front-right'] },
			{ ...trial, stimulusSets: 'A/B/C' },
			{ ...trial, stimulusSets: stimulusSetsArrayLike },
			{ ...trial, stimulusSets: [trial.stimulusSets[0]] },
			{ ...trial, stimulusSets: [null, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], blindLabel: 'Z' }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], renderer: 'debug' }, ...trial.stimulusSets.slice(1)] },
			invalidRendererTrial,
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: 'artifact' }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: artifactsArrayLike }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [trial.stimulusSets[0].artifacts[0]] }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [null, ...trial.stimulusSets[0].artifacts.slice(1)] }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [{ ...trial.stimulusSets[0].artifacts[0], direction: 'side' }, ...trial.stimulusSets[0].artifacts.slice(1)] }, ...trial.stimulusSets.slice(1)] },
			invalidArtifactDirectionTrial,
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [{ ...trial.stimulusSets[0].artifacts[0], artifactName: 'custom.png' }, ...trial.stimulusSets[0].artifacts.slice(1)] }, ...trial.stimulusSets.slice(1)] },
		]

		for (const malformedTrial of malformedTrials) {
			expect(() => assertOfficialBlindEvaluationTrial(malformedTrial)).toThrowError('Blind evaluation trials must use official primary preset metadata')
		}
	})
})
