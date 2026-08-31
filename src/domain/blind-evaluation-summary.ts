import type { OfficialFixtureKey } from './artifact-matrix'
import type { DecisionOutcome, DefectKey } from './blind-evaluation-protocol'
import type { BlindEvaluationResponsePacket, BlindEvaluationResponsePacketTrial } from './blind-evaluation-response'
import type { BlindComparisonAnswerKey, BlindComparisonLabel } from './comparison-evaluation-manifest'
import type { OfficialRendererVariantKey } from './renderer-variant'

import { assert } from '../utils/error'
import { OFFICIAL_BLIND_EVALUATION_PROTOCOL } from './blind-evaluation-protocol'
import { OFFICIAL_BLIND_COMPARISON_ANSWER_KEY, OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'

export type RendererPreferenceCounts = Record<OfficialRendererVariantKey, number>
export type DefectCounts = Record<DefectKey, number>

export type BlindEvaluationOutcomeGuidance = {
	outcome: DecisionOutcome
	evidenceStandard: 'practical-validation-not-statistical-proof'
	specializedPreferenceThreshold: number
	nonNoneUsableJudgmentCount: number
	noneUsableJudgmentCount: number
	rendererPreferenceShares: Record<OfficialRendererVariantKey, number>
	leadingSpecializedRenderer: OfficialRendererVariantKey | null
	rationale: ReadonlyArray<string>
}

export type BlindEvaluationSummary = {
	preferenceCounts: {
		totalNonNoneUsableJudgments: number
		byRenderer: RendererPreferenceCounts
		byTrial: ReadonlyArray<{
			trialId: string
			totalNonNoneUsableJudgments: number
			byRenderer: RendererPreferenceCounts
		}>
	}
	defectClusters: {
		byDefect: ReadonlyArray<DefectCluster>
		byRenderer: Record<OfficialRendererVariantKey, DefectCounts>
	}
	cleanupNoteClusters: ReadonlyArray<CleanupNoteCluster>
	defectActionability: {
		isSmallActionableDefectSet: boolean
		recurringRendererRuleAdjustmentCount: number
		recurringDefects: ReadonlyArray<DefectCluster>
		wholesaleFailedFixtures: ReadonlyArray<OfficialFixtureKey>
	}
	outcomeGuidance: BlindEvaluationOutcomeGuidance
}

export type DefectCluster = {
	defect: DefectKey
	count: number
}

export type CleanupNoteCluster = {
	normalizedNote: string
	count: number
}

const BLIND_LABELS = ['A', 'B', 'C'] as const satisfies ReadonlyArray<BlindComparisonLabel>
const RECURRING_CLUSTER_MINIMUM_COUNT = 2
const MAX_ACTIONABLE_RECURRING_DEFECTS = 3
const SPECIALIZED_PREFERENCE_THRESHOLD = 0.7
const SPECIALIZED_RENDERERS = ['conservative', 'full'] as const satisfies ReadonlyArray<OfficialRendererVariantKey>

export function summarizeBlindEvaluationResponses(
	packets: ReadonlyArray<BlindEvaluationResponsePacket>,
	answerKey: ReadonlyArray<BlindComparisonAnswerKey> = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY,
): BlindEvaluationSummary {
	const labelMapsByTrialId = rendererLabelMaps(answerKey)
	const preferenceTotals = emptyRendererCounts()
	const preferenceByTrial = OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => ({
		trialId: trial.trialId,
		totalNonNoneUsableJudgments: 0,
		byRenderer: emptyRendererCounts(),
	}))
	const preferenceByTrialId = new Map(preferenceByTrial.map((trialCounts) => [trialCounts.trialId, trialCounts]))
	const defectsByRenderer = emptyRendererDefectCounts()
	const defectTotals = emptyDefectCounts()
	const cleanupNoteCounts = new Map<string, number>()
	const fixtureJudgments = new Map<OfficialFixtureKey, { total: number, noneUsable: number }>()

	for (const packet of packets) {
		for (const trialPacket of packet.trialPackets) {
			const labelMap = labelMapsByTrialId.get(trialPacket.trialId)
			assert(labelMap !== undefined, 'Blind evaluation summary requires an answer key for every trial')
			summarizePreference(trialPacket, labelMap, preferenceTotals, preferenceByTrialId)
			summarizeDefects(trialPacket, labelMap, defectTotals, defectsByRenderer)
			summarizeCleanupNotes(trialPacket.response.cleanupNotes, cleanupNoteCounts)
			summarizeFixtureJudgment(trialPacket, fixtureJudgments)
		}
	}

	const byDefect = sortedDefectClusters(defectTotals)
	const recurringDefects = byDefect.filter((cluster) => cluster.count >= RECURRING_CLUSTER_MINIMUM_COUNT)
	const wholesaleFailedFixtures = fixtureWholesaleFailures(fixtureJudgments)
	const defectActionability = {
		isSmallActionableDefectSet: recurringDefects.length <= MAX_ACTIONABLE_RECURRING_DEFECTS && wholesaleFailedFixtures.length === 0,
		recurringRendererRuleAdjustmentCount: recurringDefects.length,
		recurringDefects,
		wholesaleFailedFixtures,
	}
	const totalNonNoneUsableJudgments = Object.values(preferenceTotals).reduce((sum, count) => sum + count, 0)
	const noneUsableJudgmentCount = [...fixtureJudgments.values()].reduce((sum, judgment) => sum + judgment.noneUsable, 0)

	return {
		preferenceCounts: {
			totalNonNoneUsableJudgments,
			byRenderer: preferenceTotals,
			byTrial: preferenceByTrial,
		},
		defectClusters: {
			byDefect,
			byRenderer: defectsByRenderer,
		},
		cleanupNoteClusters: sortedCleanupNoteClusters(cleanupNoteCounts),
		defectActionability,
		outcomeGuidance: classifyBlindEvaluationOutcome({
			preferenceCounts: preferenceTotals,
			defectsByRenderer,
			defectActionability,
			totalNonNoneUsableJudgments,
			noneUsableJudgmentCount,
		}),
	}
}

function summarizePreference(
	trialPacket: BlindEvaluationResponsePacketTrial,
	labelMap: Map<BlindComparisonLabel, OfficialRendererVariantKey>,
	preferenceTotals: RendererPreferenceCounts,
	preferenceByTrialId: Map<string, { totalNonNoneUsableJudgments: number, byRenderer: RendererPreferenceCounts }>,
): void {
	if (trialPacket.response.noneUsable) {
		return
	}
	const preferredLabel = trialPacket.response.ranking[0]
	assert(preferredLabel !== undefined, 'Blind evaluation summary requires complete rankings')
	const preferredRenderer = labelMap.get(preferredLabel)
	// Stryker disable next-line ConditionalExpression: missing preferred-label assignments are also rejected while summarizing label defects for the same trial.
	assert(preferredRenderer !== undefined, 'Blind evaluation summary requires answer-key assignments for every label')
	preferenceTotals[preferredRenderer] += 1
	const trialCounts = preferenceByTrialId.get(trialPacket.trialId)
	assert(trialCounts !== undefined, 'Blind evaluation summary requires official trial context')
	trialCounts.totalNonNoneUsableJudgments += 1
	trialCounts.byRenderer[preferredRenderer] += 1
}

function summarizeDefects(
	trialPacket: BlindEvaluationResponsePacketTrial,
	labelMap: Map<BlindComparisonLabel, OfficialRendererVariantKey>,
	defectTotals: DefectCounts,
	defectsByRenderer: Record<OfficialRendererVariantKey, DefectCounts>,
): void {
	for (const defect of trialPacket.response.defects.trial) {
		defectTotals[defect] += 1
	}
	for (const label of BLIND_LABELS) {
		const renderer = labelMap.get(label)
		// Stryker disable next-line ConditionalExpression: missing nonpreferred-label assignments otherwise fail on the renderer defect bucket lookup.
		assert(renderer !== undefined, 'Blind evaluation summary requires answer-key assignments for every label')
		for (const defect of trialPacket.response.defects.byOption[label]) {
			defectTotals[defect] += 1
			defectsByRenderer[renderer][defect] += 1
		}
	}
}

function summarizeCleanupNotes(cleanupNotes: string, cleanupNoteCounts: Map<string, number>): void {
	const normalizedNote = cleanupNotes.trim().toLowerCase().replace(/[.!?]+$/u, '')
	if (normalizedNote.length === 0) {
		return
	}
	cleanupNoteCounts.set(normalizedNote, (cleanupNoteCounts.get(normalizedNote) ?? 0) + 1)
}

function summarizeFixtureJudgment(
	trialPacket: BlindEvaluationResponsePacketTrial,
	fixtureJudgments: Map<OfficialFixtureKey, { total: number, noneUsable: number }>,
): void {
	const fixture = trialPacket.context.fixture
	const current = fixtureJudgments.get(fixture) ?? { total: 0, noneUsable: 0 }
	current.total += 1
	if (trialPacket.response.noneUsable) {
		current.noneUsable += 1
	}
	fixtureJudgments.set(fixture, current)
}

type BlindEvaluationOutcomeInput = {
	preferenceCounts: RendererPreferenceCounts
	defectsByRenderer: Record<OfficialRendererVariantKey, DefectCounts>
	defectActionability: BlindEvaluationSummary['defectActionability']
	totalNonNoneUsableJudgments: number
	noneUsableJudgmentCount: number
}

type BlindEvaluationOutcomeContext = BlindEvaluationOutcomeInput & {
	rendererPreferenceShares: Record<OfficialRendererVariantKey, number>
	leadingSpecializedRenderer: OfficialRendererVariantKey | null
	leadingSpecializedShare: number
	specializedPreferenceCount: number
}

type BlindEvaluationOutcomeRule = {
	matches: (context: BlindEvaluationOutcomeContext) => boolean
	outcome: DecisionOutcome
	rationale: ReadonlyArray<string>
}

const BLIND_EVALUATION_OUTCOME_RULES: ReadonlyArray<BlindEvaluationOutcomeRule> = [
	{
		matches: hasNoUsablePreferenceJudgments,
		outcome: 'stop/rethink',
		rationale: ['No usable renderer preference judgments remain after excluding none-usable trials.'],
	},
	{
		matches: hasCommonNoneUsableJudgments,
		outcome: 'stop/rethink',
		rationale: ['None-usable judgments are common enough to outweigh renderer preference evidence.'],
	},
	{
		matches: canProceedWithSpecializedRenderer,
		outcome: 'proceed',
		rationale: [
			'A specialized renderer reached the 70% practical-validation preference guide over non-none-usable judgments.',
			'Recurring defects are limited to a small actionable renderer-rule set with no wholesale fixture failure.',
		],
	},
	{
		matches: shouldNarrowScope,
		outcome: 'narrow scope',
		rationale: ['Specialized renderers are competitive, but at least one fixture class fails wholesale.'],
	},
	{
		matches: shouldReviseRenderer,
		outcome: 'revise renderer',
		rationale: [
			'Specialized renderer preference beats or ties baseline after considering conservative/full split preference.',
			'Remaining recurring defects need renderer-rule revision before proceeding.',
		],
	},
] as const

export function classifyBlindEvaluationOutcome(input: BlindEvaluationOutcomeInput): BlindEvaluationOutcomeGuidance {
	const context = blindEvaluationOutcomeContext(input)
	const rule = BLIND_EVALUATION_OUTCOME_RULES.find((candidate) => candidate.matches(context))
	return outcomeGuidance(
		rule?.outcome ?? 'stop/rethink',
		context.rendererPreferenceShares,
		context.leadingSpecializedRenderer,
		rule?.rationale ?? ['Baseline preference exceeds the combined specialized-renderer preference evidence.'],
		input,
	)
}

function blindEvaluationOutcomeContext(input: BlindEvaluationOutcomeInput): BlindEvaluationOutcomeContext {
	const rendererPreferenceShares = rendererShares(input.preferenceCounts, input.totalNonNoneUsableJudgments)
	const leadingSpecializedRenderer = preferredSpecializedRenderer(input.preferenceCounts, input.defectsByRenderer)
	return {
		...input,
		rendererPreferenceShares,
		leadingSpecializedRenderer,
		leadingSpecializedShare: specializedShare(leadingSpecializedRenderer, rendererPreferenceShares),
		specializedPreferenceCount: SPECIALIZED_RENDERERS.reduce((sum, renderer) => sum + input.preferenceCounts[renderer], 0),
	}
}

function hasNoUsablePreferenceJudgments(context: BlindEvaluationOutcomeContext): boolean {
	return context.totalNonNoneUsableJudgments === 0
}

function hasCommonNoneUsableJudgments(context: BlindEvaluationOutcomeContext): boolean {
	return context.noneUsableJudgmentCount > context.totalNonNoneUsableJudgments
}

function canProceedWithSpecializedRenderer(context: BlindEvaluationOutcomeContext): boolean {
	return reachesSpecializedPreferenceThreshold(context) && context.defectActionability.isSmallActionableDefectSet
}

function shouldNarrowScope(context: BlindEvaluationOutcomeContext): boolean {
	return hasWholesaleFixtureFailure(context) && specializedBeatsOrTiesBaseline(context)
}

function shouldReviseRenderer(context: BlindEvaluationOutcomeContext): boolean {
	return specializedBeatsOrTiesBaseline(context)
}

function reachesSpecializedPreferenceThreshold(context: BlindEvaluationOutcomeContext): boolean {
	return context.leadingSpecializedShare >= SPECIALIZED_PREFERENCE_THRESHOLD
}

function hasWholesaleFixtureFailure(context: BlindEvaluationOutcomeContext): boolean {
	return context.defectActionability.wholesaleFailedFixtures.length > 0
}

function specializedBeatsOrTiesBaseline(context: BlindEvaluationOutcomeContext): boolean {
	return context.specializedPreferenceCount >= context.preferenceCounts.baseline
}

function specializedShare(
	leadingSpecializedRenderer: OfficialRendererVariantKey | null,
	rendererPreferenceShares: Record<OfficialRendererVariantKey, number>,
): number {
	// Stryker disable next-line ConditionalExpression: null leading renderer still cannot meet the numeric threshold, so outcome behavior is equivalent.
	return leadingSpecializedRenderer === null ? 0 : rendererPreferenceShares[leadingSpecializedRenderer]
}

function rendererLabelMaps(answerKey: ReadonlyArray<BlindComparisonAnswerKey>): Map<string, Map<BlindComparisonLabel, OfficialRendererVariantKey>> {
	return new Map(answerKey.map((trialAnswer) => [
		trialAnswer.trialId,
		new Map(trialAnswer.assignments.map((assignment) => [assignment.blindLabel, assignment.renderer])),
	]))
}

function sortedDefectClusters(defectCounts: DefectCounts): ReadonlyArray<DefectCluster> {
	return OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy
		.map((defect) => ({ defect, count: defectCounts[defect] }))
		.filter((cluster) => cluster.count > 0)
		.sort(compareClusters)
}

function sortedCleanupNoteClusters(cleanupNoteCounts: Map<string, number>): ReadonlyArray<CleanupNoteCluster> {
	return [...cleanupNoteCounts.entries()]
		.map(([normalizedNote, count]) => ({ normalizedNote, count }))
		.sort((left, right) => right.count - left.count || left.normalizedNote.localeCompare(right.normalizedNote))
}

function fixtureWholesaleFailures(fixtureJudgments: Map<OfficialFixtureKey, { total: number, noneUsable: number }>): ReadonlyArray<OfficialFixtureKey> {
	return [...fixtureJudgments.entries()]
		.filter(([, judgment]) => judgment.total === judgment.noneUsable)
		.map(([fixture]) => fixture)
		.sort()
}

function compareClusters(left: DefectCluster, right: DefectCluster): number {
	return right.count - left.count || left.defect.localeCompare(right.defect)
}

function rendererShares(preferenceCounts: RendererPreferenceCounts, totalNonNoneUsableJudgments: number): Record<OfficialRendererVariantKey, number> {
	if (totalNonNoneUsableJudgments === 0) {
		return { baseline: 0, conservative: 0, full: 0 }
	}
	return {
		baseline: preferenceCounts.baseline / totalNonNoneUsableJudgments,
		conservative: preferenceCounts.conservative / totalNonNoneUsableJudgments,
		full: preferenceCounts.full / totalNonNoneUsableJudgments,
	}
}

function preferredSpecializedRenderer(
	preferenceCounts: RendererPreferenceCounts,
	defectsByRenderer: Record<OfficialRendererVariantKey, DefectCounts>,
): OfficialRendererVariantKey | null {
	const [firstRenderer, secondRenderer] = SPECIALIZED_RENDERERS
	// Stryker disable next-line ConditionalExpression,LogicalOperator: fixed specialized-renderer tuple cardinality is compile-time protocol wiring.
	assert(firstRenderer !== undefined && secondRenderer !== undefined, 'Blind evaluation outcome requires specialized renderer definitions')
	const preferenceDifference = preferenceCounts[firstRenderer] - preferenceCounts[secondRenderer]
	if (preferenceDifference > 0) {
		return firstRenderer
	}
	if (preferenceDifference < 0) {
		return secondRenderer
	}
	const firstDefects = totalDefects(defectsByRenderer[firstRenderer])
	const secondDefects = totalDefects(defectsByRenderer[secondRenderer])
	if (firstDefects < secondDefects) {
		return firstRenderer
	}
	if (secondDefects < firstDefects) {
		return secondRenderer
	}
	return null
}

function totalDefects(defectCounts: DefectCounts): number {
	return Object.values(defectCounts).reduce((sum, count) => sum + count, 0)
}

function outcomeGuidance(
	outcome: DecisionOutcome,
	rendererPreferenceShares: Record<OfficialRendererVariantKey, number>,
	leadingSpecializedRenderer: OfficialRendererVariantKey | null,
	rationale: ReadonlyArray<string>,
	input: { totalNonNoneUsableJudgments: number, noneUsableJudgmentCount: number },
): BlindEvaluationOutcomeGuidance {
	return {
		outcome,
		evidenceStandard: 'practical-validation-not-statistical-proof',
		specializedPreferenceThreshold: SPECIALIZED_PREFERENCE_THRESHOLD,
		nonNoneUsableJudgmentCount: input.totalNonNoneUsableJudgments,
		noneUsableJudgmentCount: input.noneUsableJudgmentCount,
		rendererPreferenceShares,
		leadingSpecializedRenderer,
		rationale,
	}
}

function emptyRendererCounts(): RendererPreferenceCounts {
	return {
		baseline: 0,
		conservative: 0,
		full: 0,
	}
}

function emptyRendererDefectCounts(): Record<OfficialRendererVariantKey, DefectCounts> {
	return {
		baseline: emptyDefectCounts(),
		conservative: emptyDefectCounts(),
		full: emptyDefectCounts(),
	}
}

function emptyDefectCounts(): DefectCounts {
	return {
		'weak-or-unclear-silhouette': 0,
		'noisy-pixel-clusters': 0,
		'excessive-internal-edges': 0,
		'muddy-or-over-busy-lighting': 0,
		'detail-lost-or-merged-incorrectly': 0,
		'inconsistent-appearance-across-views': 0,
		'outline-problems': 0,
		'palette-color-awkwardness': 0,
		'too-voxel-3d-looking': 0,
		'other-free-text': 0,
	}
}
