import { describe, expect, it } from 'vitest'

import {
	OFFICIAL_ARTIFACT_MATRIX,
	OFFICIAL_FIXTURE_KEYS,
	officialArtifactName,
} from './artifact-matrix'
import { OFFICIAL_CAMERA_DIRECTION_PRESETS, OFFICIAL_CAMERA_ELEVATION_PRESETS } from './camera-output-preset'
import {
	assertOfficialBlindComparisonTrial,
	assertOfficialComparisonManifestEntry,
	createBlindComparisonTrials,
	DIAGNOSTIC_DETAIL_OUTPUT_SIZE,
	OFFICIAL_BLIND_COMPARISON_ANSWER_KEY,
	OFFICIAL_BLIND_COMPARISON_TRIALS,
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

	it('builds participant-facing blind comparison trials for every fixture and elevation at the primary output size only', () => {
		expect(OFFICIAL_BLIND_COMPARISON_TRIALS).toHaveLength(
			OFFICIAL_FIXTURE_KEYS.length * OFFICIAL_CAMERA_ELEVATION_PRESETS.length,
		)
		expect(OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => trial.trialId)).toEqual([
			'chest__elev26__64',
			'chest__elev35__64',
			'chair__elev26__64',
			'chair__elev35__64',
			'lantern__elev26__64',
			'lantern__elev35__64',
			'generator__elev26__64',
			'generator__elev35__64',
			'rover__elev26__64',
			'rover__elev35__64',
		])
		expect(OFFICIAL_BLIND_COMPARISON_TRIALS.every((trial) => trial.outputSize === PRIMARY_BLIND_EVALUATION_OUTPUT_SIZE)).toBe(true)
		expect(OFFICIAL_BLIND_COMPARISON_TRIALS.some((trial) => trial.outputSize === DIAGNOSTIC_DETAIL_OUTPUT_SIZE)).toBe(false)
	})

	it('groups all four directions and all renderer variants behind anonymized A/B/C labels', () => {
		const officialDirections = OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key)

		for (const trial of OFFICIAL_BLIND_COMPARISON_TRIALS) {
			expect(trial.directions).toEqual(officialDirections)
			expect(trial.stimulusSets).toHaveLength(BLIND_EVALUATION_RENDERER_VARIANT_KEYS.length)

			for (const [variantIndex, stimulusSet] of trial.stimulusSets.entries()) {
				expect(stimulusSet.blindLabel).toBe(['A', 'B', 'C'][variantIndex])
				expect(stimulusSet).not.toHaveProperty('renderer')
				expect(stimulusSet.artifacts).toEqual(officialDirections.map((direction) => ({
					direction,
					artifactName: `${trial.fixture}__${trial.elevation}__${trial.outputSize}__${stimulusSet.blindLabel}__${direction}.png`,
				})))
			}
		}
	})

	it('keeps renderer identity out of evaluator-facing trial data', () => {
		for (const trial of OFFICIAL_BLIND_COMPARISON_TRIALS) {
			const evaluatorJson = JSON.stringify(trial)
			expect(evaluatorJson).not.toContain('baseline')
			expect(evaluatorJson).not.toContain('conservative')
			expect(evaluatorJson).not.toContain('full')
			expect(() => assertOfficialBlindComparisonTrial(trial)).not.toThrow()
		}
	})

	it('keeps renderer assignments in a separate non-evaluator answer key', () => {
		expect(OFFICIAL_BLIND_COMPARISON_ANSWER_KEY).toHaveLength(OFFICIAL_BLIND_COMPARISON_TRIALS.length)

		for (const answer of OFFICIAL_BLIND_COMPARISON_ANSWER_KEY) {
			const trial = OFFICIAL_BLIND_COMPARISON_TRIALS.find((candidate) => candidate.trialId === answer.trialId)
			expect(trial).toBeDefined()
			expect(answer.assignments.map((assignment) => assignment.blindLabel)).toEqual(['A', 'B', 'C'])
			expect([...answer.assignments.map((assignment) => assignment.renderer)].sort()).toEqual([...BLIND_EVALUATION_RENDERER_VARIANT_KEYS].sort())

			for (const assignment of answer.assignments) {
				expect(assignment.sourceArtifactNames).toEqual(OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => officialArtifactName({
					fixture: trial?.fixture ?? 'chest',
					renderer: assignment.renderer,
					elevation: trial?.elevation ?? 'elev26',
					outputSize: trial?.outputSize ?? 64,
					direction: direction.key,
				})))
			}
		}
	})

	it('randomizes label assignment deterministically by trial instead of exposing renderer order', () => {
		const answerRendererOrders = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY.map((answer) => answer.assignments.map((assignment) => assignment.renderer).join(','))

		expect(new Set(answerRendererOrders).size).toBeGreaterThan(1)
		expect(answerRendererOrders).toContain('baseline,conservative,full')
		expect(answerRendererOrders).toContain('full,baseline,conservative')
		expect(createBlindComparisonTrials(OFFICIAL_ARTIFACT_MATRIX)).toEqual({
			trials: OFFICIAL_BLIND_COMPARISON_TRIALS,
			answerKey: OFFICIAL_BLIND_COMPARISON_ANSWER_KEY,
		})
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
		expect(() => assertOfficialBlindComparisonTrial({
			...OFFICIAL_BLIND_COMPARISON_TRIALS[0],
			canvasSize: { width: 64, height: 64 },
		})).toThrowError('Blind comparison trials must use anonymized official preset metadata')
		const diagnosticSizeTrial = {
			...OFFICIAL_BLIND_COMPARISON_TRIALS[0],
			outputSize: DIAGNOSTIC_DETAIL_OUTPUT_SIZE,
			trialId: `${OFFICIAL_BLIND_COMPARISON_TRIALS[0]?.fixture}__${OFFICIAL_BLIND_COMPARISON_TRIALS[0]?.elevation}__${DIAGNOSTIC_DETAIL_OUTPUT_SIZE}`,
			stimulusSets: OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.stimulusSets.map((stimulusSet) => ({
				...stimulusSet,
				artifacts: stimulusSet.artifacts.map((artifact) => ({
					...artifact,
					artifactName: artifact.artifactName.replace('__64__', '__128__'),
				})),
			})),
		}
		expect(() => assertOfficialBlindComparisonTrial(diagnosticSizeTrial)).toThrowError('Blind comparison trials must use anonymized official preset metadata')
		expect(() => assertOfficialBlindComparisonTrial({
			...OFFICIAL_BLIND_COMPARISON_TRIALS[0],
			outputSize: 96,
		})).toThrowError('Blind comparison trials must use anonymized official preset metadata')
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

	it('rejects malformed blind-comparison trial metadata and renderer leaks', () => {
		const trial = OFFICIAL_BLIND_COMPARISON_TRIALS[0]
		const invalidArtifactDirectionTrial = {
			...trial,
			stimulusSets: [{
				...trial.stimulusSets[0],
				artifacts: [{
					...trial.stimulusSets[0].artifacts[0],
					direction: 'side',
					artifactName: `${trial.fixture}__${trial.elevation}__${trial.outputSize}__A__side.png`,
				}, ...trial.stimulusSets[0].artifacts.slice(1)],
			}, ...trial.stimulusSets.slice(1)],
		}
		const trialWithUnofficialFixtureOnly = {
			...trial,
			fixture: 'spaceship',
			trialId: `spaceship__${trial.elevation}__${trial.outputSize}`,
			stimulusSets: trial.stimulusSets.map((stimulusSet) => ({
				...stimulusSet,
				artifacts: stimulusSet.artifacts.map((artifact) => ({
					...artifact,
					artifactName: artifact.artifactName.replace('chest', 'spaceship'),
				})),
			})),
		}
		const trialWithUnofficialElevationOnly = {
			...trial,
			elevation: 'elev45',
			trialId: `${trial.fixture}__elev45__${trial.outputSize}`,
			stimulusSets: trial.stimulusSets.map((stimulusSet) => ({
				...stimulusSet,
				artifacts: stimulusSet.artifacts.map((artifact) => ({
					...artifact,
					artifactName: artifact.artifactName.replace('elev26', 'elev45'),
				})),
			})),
		}
		const trialWithUnofficialOutputSizeOnly = {
			...trial,
			outputSize: 96,
			trialId: `${trial.fixture}__${trial.elevation}__96`,
			stimulusSets: trial.stimulusSets.map((stimulusSet) => ({
				...stimulusSet,
				artifacts: stimulusSet.artifacts.map((artifact) => ({
					...artifact,
					artifactName: artifact.artifactName.replace('__64__', '__96__'),
				})),
			})),
		}
		const trialWithArtifactExtraKeyOnly = {
			...trial,
			stimulusSets: [{
				...trial.stimulusSets[0],
				artifacts: [{ ...trial.stimulusSets[0].artifacts[0], renderer: 'baseline' }, ...trial.stimulusSets[0].artifacts.slice(1)],
			}, ...trial.stimulusSets.slice(1)],
		}
		const directionsArrayLike = {
			length: 4,
			every: () => true,
		}
		const stimulusSetsArrayLike = {
			length: 3,
			entries: function* entries() {},
		}
		const artifactsArrayLike = {
			length: 4,
			entries: function* entries() {},
		}
		const malformedTrials = [
			null,
			[],
			undefined,
			trialWithUnofficialFixtureOnly,
			trialWithUnofficialElevationOnly,
			trialWithUnofficialOutputSizeOnly,
			trialWithArtifactExtraKeyOnly,
			{ ...trial, fixture: 'spaceship' },
			{ ...trial, elevation: 'elev45' },
			{ ...trial, outputSize: 96 },
			{ ...trial, trialId: 'renamed-trial' },
			{ ...trial, directions: directionsArrayLike },
			{ ...trial, stimulusSets: stimulusSetsArrayLike },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: artifactsArrayLike }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, directions: 'front-right' },
			{ ...trial, directions: ['front-right'] },
			{ ...trial, directions: ['front-left', 'back-right', 'back-left', 'front-right'] },
			{ ...trial, stimulusSets: 'A/B/C' },
			{ ...trial, stimulusSets: [trial.stimulusSets[0]] },
			{ ...trial, stimulusSets: [null, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], blindLabel: 'Z' }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], renderer: 'baseline' }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: 'artifact' }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [trial.stimulusSets[0].artifacts[0]] }, ...trial.stimulusSets.slice(1)] },
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [null, ...trial.stimulusSets[0].artifacts.slice(1)] }, ...trial.stimulusSets.slice(1)] },
			invalidArtifactDirectionTrial,
			{ ...trial, stimulusSets: [{ ...trial.stimulusSets[0], artifacts: [{ ...trial.stimulusSets[0].artifacts[0], artifactName: 'custom.png' }, ...trial.stimulusSets[0].artifacts.slice(1)] }, ...trial.stimulusSets.slice(1)] },
		]

		for (const malformedTrial of malformedTrials) {
			expect(() => assertOfficialBlindComparisonTrial(malformedTrial)).toThrowError('Blind comparison trials must use anonymized official preset metadata')
		}
	})

	it('rejects missing official source artifacts when building blind trials', () => {
		expect(() => createBlindComparisonTrials(OFFICIAL_ARTIFACT_MATRIX.slice(1))).toThrowError(
			'Missing official artifact \'chest__baseline__elev26__64__front-right.png\' for blind comparison trial.',
		)
	})
})
