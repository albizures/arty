import type { OfficialFixtureKey } from './artifact-matrix'
import type { DefectKey } from './blind-evaluation-protocol'
import type { CameraDirectionPresetKey, CameraElevationPresetKey, OutputSizePresetKey } from './camera-output-preset'
import type { BlindComparisonLabel, BlindComparisonTrial } from './comparison-evaluation-manifest'

import { assert } from '../utils/error'
import { OFFICIAL_BLIND_EVALUATION_PROTOCOL } from './blind-evaluation-protocol'
import { OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'

export type BlindTrialDefectSelections = {
	trial: ReadonlyArray<DefectKey>
	byOption: Record<BlindComparisonLabel, ReadonlyArray<DefectKey>>
}

export type BlindTrialResponse = {
	trialId: string
	ranking: ReadonlyArray<BlindComparisonLabel>
	noneUsable: boolean
	defects: BlindTrialDefectSelections
	cleanupNotes: string
}

export type BlindEvaluationResponsePacketTrial = {
	trialId: string
	context: {
		fixture: OfficialFixtureKey
		elevation: CameraElevationPresetKey
		outputSize: OutputSizePresetKey
		directions: ReadonlyArray<CameraDirectionPresetKey>
		optionLabels: ReadonlyArray<BlindComparisonLabel>
	}
	response: BlindTrialResponse
}

export type BlindEvaluationResponsePacket = {
	packetKind: 'phase-0-blind-evaluation-response-packet'
	protocol: {
		participantOutputSize: OutputSizePresetKey
		fixtureCount: number
		elevationCount: number
		directionsShownTogether: ReadonlyArray<CameraDirectionPresetKey>
		ratingQuestionKeys: ReadonlyArray<string>
		defectTaxonomy: ReadonlyArray<DefectKey>
	}
	evaluatorSessionId: string
	completedAtIso: string
	trialPackets: ReadonlyArray<BlindEvaluationResponsePacketTrial>
}

export type CreateBlindEvaluationResponsePacketInput = {
	evaluatorSessionId?: string
	completedAtIso: string
	responses: ReadonlyArray<BlindTrialResponse>
}

const BLIND_EVALUATION_RESPONSE_ERROR = 'Blind evaluation response must use the official trial response format'
const BLIND_LABELS = ['A', 'B', 'C'] as const satisfies ReadonlyArray<BlindComparisonLabel>
const BLIND_LABEL_SET: ReadonlySet<unknown> = new Set(BLIND_LABELS)
const DEFECT_KEY_SET: ReadonlySet<unknown> = new Set(OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy)
const OFFICIAL_TRIAL_ID_SET: ReadonlySet<unknown> = new Set(OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => trial.trialId))
const MAX_CLEANUP_NOTES_LENGTH = 500
const RESPONSE_PACKET_ERROR = 'Blind evaluation response packet must contain exactly one complete response for every official trial'
const RESPONSE_PACKET_COMPLETION_ERROR = 'Blind evaluation response packet must contain ISO completion metadata'

export function createEmptyBlindTrialResponse(trial: BlindComparisonTrial): BlindTrialResponse {
	return {
		trialId: trial.trialId,
		ranking: [],
		noneUsable: false,
		defects: emptyDefectSelections(),
		cleanupNotes: '',
	}
}

export function createEmptyOfficialBlindEvaluationResponses(): ReadonlyArray<BlindTrialResponse> {
	return OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => createEmptyBlindTrialResponse(trial))
}

export function createEmptyOfficialBlindEvaluationResponsePacket(): BlindEvaluationResponsePacket {
	return createResponsePacket('', createEmptyOfficialBlindEvaluationResponses(), '')
}

export function createOfficialBlindEvaluationResponsePacket(input: CreateBlindEvaluationResponsePacketInput): BlindEvaluationResponsePacket {
	assert(isIsoDateString(input.completedAtIso), RESPONSE_PACKET_COMPLETION_ERROR)
	assertCompleteOfficialResponseSet(input.responses)
	return createResponsePacket(input.evaluatorSessionId ?? '', input.responses, input.completedAtIso)
}

export function assertCompleteBlindTrialResponse(value: unknown): asserts value is BlindTrialResponse {
	assert(isRecord(value), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(Object.keys(value).every((key) => ['trialId', 'ranking', 'noneUsable', 'defects', 'cleanupNotes'].includes(key)), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(OFFICIAL_TRIAL_ID_SET.has(value.trialId), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(isCompleteRanking(value.ranking), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(typeof value.noneUsable === 'boolean', BLIND_EVALUATION_RESPONSE_ERROR)
	assertOfficialDefectSelections(value.defects)
	assert(typeof value.cleanupNotes === 'string', BLIND_EVALUATION_RESPONSE_ERROR)
	assert(value.cleanupNotes.length <= MAX_CLEANUP_NOTES_LENGTH, BLIND_EVALUATION_RESPONSE_ERROR)
}

function createResponsePacket(
	evaluatorSessionId: string,
	responses: ReadonlyArray<BlindTrialResponse>,
	completedAtIso: string,
): BlindEvaluationResponsePacket {
	const responsesByTrialId = new Map<string, BlindTrialResponse>(responses.map((response) => [response.trialId, response]))

	return {
		packetKind: 'phase-0-blind-evaluation-response-packet',
		protocol: {
			participantOutputSize: OFFICIAL_BLIND_EVALUATION_PROTOCOL.stimulusScope.participantOutputSize,
			fixtureCount: OFFICIAL_BLIND_EVALUATION_PROTOCOL.stimulusScope.fixtures.length,
			elevationCount: OFFICIAL_BLIND_EVALUATION_PROTOCOL.stimulusScope.elevations.length,
			directionsShownTogether: OFFICIAL_BLIND_EVALUATION_PROTOCOL.stimulusScope.directionsShownTogether,
			ratingQuestionKeys: OFFICIAL_BLIND_EVALUATION_PROTOCOL.ratingQuestions.map((question) => question.key),
			defectTaxonomy: OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy,
		},
		evaluatorSessionId,
		completedAtIso,
		trialPackets: OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => {
			const response = responsesByTrialId.get(trial.trialId) as BlindTrialResponse
			return {
				trialId: trial.trialId,
				context: {
					fixture: trial.fixture,
					elevation: trial.elevation,
					outputSize: trial.outputSize,
					directions: trial.directions,
					optionLabels: BLIND_LABELS,
				},
				response,
			}
		}),
	}
}

function assertCompleteOfficialResponseSet(responses: ReadonlyArray<BlindTrialResponse>): void {
	assert(responses.length === OFFICIAL_BLIND_COMPARISON_TRIALS.length, RESPONSE_PACKET_ERROR)
	const seenTrialIds = new Set<string>()
	for (const response of responses) {
		assertCompleteBlindTrialResponse(response)
		assert(!seenTrialIds.has(response.trialId), RESPONSE_PACKET_ERROR)
		seenTrialIds.add(response.trialId)
	}
}

function emptyDefectSelections(): BlindTrialDefectSelections {
	return {
		trial: [],
		byOption: { A: [], B: [], C: [] },
	}
}

function isCompleteRanking(value: unknown): value is ReadonlyArray<BlindComparisonLabel> {
	return Array.isArray(value)
		&& value.length === BLIND_LABELS.length
		&& value.every((label) => BLIND_LABEL_SET.has(label))
		&& new Set(value).size === BLIND_LABELS.length
}

function assertOfficialDefectSelections(value: unknown): asserts value is BlindTrialDefectSelections {
	assert(isRecord(value), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(Object.keys(value).every((key) => ['trial', 'byOption'].includes(key)), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(isDefectList(value.trial), BLIND_EVALUATION_RESPONSE_ERROR)
	// Stryker disable next-line CallExpression: invalid by-option containers are also rejected by key cardinality and label-specific defect-list checks.
	assert(isRecord(value.byOption), BLIND_EVALUATION_RESPONSE_ERROR)
	assert(Object.keys(value.byOption).length === BLIND_LABELS.length, BLIND_EVALUATION_RESPONSE_ERROR)
	for (const label of BLIND_LABELS) {
		assert(isDefectList(value.byOption[label]), BLIND_EVALUATION_RESPONSE_ERROR)
	}
}

function isDefectList(value: unknown): value is ReadonlyArray<DefectKey> {
	return Array.isArray(value) && value.every((defect) => DEFECT_KEY_SET.has(defect))
}

function isIsoDateString(value: unknown): value is string {
	// Stryker disable next-line ConditionalExpression,BlockStatement: non-string completion metadata is rejected by the exact ISO string comparison below as well.
	if (typeof value !== 'string') {
		return false
	}
	const parsed = new Date(value)
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
	// Stryker disable next-line ConditionalExpression: object/array/null invalid shapes are also covered by caller-specific key and field assertions.
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
