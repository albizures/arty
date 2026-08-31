import type { BlindEvaluationResponsePacket } from './blind-evaluation-response'
import type { BlindComparisonLabel } from './comparison-evaluation-manifest'
import type { OfficialRendererVariantKey } from './renderer-variant'

import { describe, expect, it } from 'vitest'

import { createEmptyBlindTrialResponse, createOfficialBlindEvaluationResponsePacket } from './blind-evaluation-response'
import { classifyBlindEvaluationOutcome, summarizeBlindEvaluationResponses } from './blind-evaluation-summary'
import { OFFICIAL_BLIND_COMPARISON_ANSWER_KEY, OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'

describe('blind evaluation response summary', () => {
	it('counts renderer preferences from first-place rankings while excluding none-usable judgments', () => {
		const trial = OFFICIAL_BLIND_COMPARISON_TRIALS[0]!
		const preferredLabel = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY[0]!.assignments.find((assignment) => assignment.renderer === 'conservative')!.blindLabel
		const noneUsableLabel = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY[0]!.assignments.find((assignment) => assignment.renderer === 'baseline')!.blindLabel

		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(trial.trialId, { ranking: rankingWithFirst(preferredLabel), noneUsable: false }),
			packetWithTrialResponse(trial.trialId, { ranking: rankingWithFirst(noneUsableLabel), noneUsable: true }),
		])

		expect(summary.preferenceCounts.totalNonNoneUsableJudgments).toBe(1)
		expect(summary.preferenceCounts.byRenderer).toEqual({ baseline: 0, conservative: 1, full: 0 })
		expect(summary.preferenceCounts.byTrial[0]).toMatchObject({
			trialId: trial.trialId,
			totalNonNoneUsableJudgments: 1,
			byRenderer: { baseline: 0, conservative: 1, full: 0 },
		})
	})

	it('clusters defect selections and cleanup notes so recurring visual problems are visible', () => {
		const firstTrial = OFFICIAL_BLIND_COMPARISON_TRIALS[0]!
		const secondTrial = OFFICIAL_BLIND_COMPARISON_TRIALS[1]!
		const fullLabel = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY[0]!.assignments.find((assignment) => assignment.renderer === 'full')!.blindLabel
		const secondFullLabel = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY[1]!.assignments.find((assignment) => assignment.renderer === 'full')!.blindLabel

		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(firstTrial.trialId, {
				defects: {
					trial: ['outline-problems', 'palette-color-awkwardness', 'palette-color-awkwardness', 'palette-color-awkwardness'],
					byOption: { A: [], B: [], C: [], [fullLabel]: ['noisy-pixel-clusters'] },
				},
				cleanupNotes: 'Outline cleanup may help.',
			}),
			packetWithTrialResponse(secondTrial.trialId, {
				defects: {
					trial: ['outline-problems'],
					byOption: { A: [], B: [], C: [], [secondFullLabel]: ['noisy-pixel-clusters'] },
				},
				cleanupNotes: ' outline cleanup may help ',
			}),
			packetWithTrialResponse(firstTrial.trialId, { cleanupNotes: 'Increase contrast.' }),
			packetWithTrialResponse(firstTrial.trialId, { cleanupNotes: 'Add shadow.' }),
		])

		expect(summary.defectClusters.byDefect).toEqual([
			{ defect: 'palette-color-awkwardness', count: 3 },
			{ defect: 'noisy-pixel-clusters', count: 2 },
			{ defect: 'outline-problems', count: 2 },
		])
		expect(summary.defectClusters.byRenderer.full).toEqual({
			'weak-or-unclear-silhouette': 0,
			'noisy-pixel-clusters': 2,
			'excessive-internal-edges': 0,
			'muddy-or-over-busy-lighting': 0,
			'detail-lost-or-merged-incorrectly': 0,
			'inconsistent-appearance-across-views': 0,
			'outline-problems': 0,
			'palette-color-awkwardness': 0,
			'too-voxel-3d-looking': 0,
			'other-free-text': 0,
		})
		expect(summary.cleanupNoteClusters).toEqual([
			{ normalizedNote: 'outline cleanup may help', count: 2 },
			{ normalizedNote: 'add shadow', count: 1 },
			{ normalizedNote: 'increase contrast', count: 1 },
		])
		expect(summary.defectActionability.recurringDefects.map((cluster) => cluster.defect)).toEqual(['palette-color-awkwardness', 'noisy-pixel-clusters', 'outline-problems'])
	})

	it('normalizes cleanup notes only by trimming, lowercasing, and removing terminal punctuation', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.trialId, { cleanupNotes: 'Needs cleanup!!!' }),
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[1]!.trialId, { cleanupNotes: 'Needs cleanup' }),
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[2]!.trialId, { cleanupNotes: 'Needs. cleanup' }),
		])

		expect(summary.cleanupNoteClusters).toEqual([
			{ normalizedNote: 'needs cleanup', count: 2 },
			{ normalizedNote: 'needs. cleanup', count: 1 },
		])
	})

	it('identifies whether defect findings are small and actionable', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.trialId, { defects: { trial: ['outline-problems', 'noisy-pixel-clusters'], byOption: { A: [], B: [], C: [] } } }, { defaultNoneUsable: false }),
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[1]!.trialId, { defects: { trial: ['outline-problems', 'noisy-pixel-clusters'], byOption: { A: [], B: [], C: [] } } }, { defaultNoneUsable: false }),
		])

		expect(summary.defectActionability).toMatchObject({
			isSmallActionableDefectSet: true,
			recurringRendererRuleAdjustmentCount: 2,
			wholesaleFailedFixtures: [],
		})
	})

	it('does not treat one-off defects as recurring renderer-rule adjustments', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.trialId, { defects: { trial: ['outline-problems'], byOption: { A: [], B: [], C: [] } } }, { defaultNoneUsable: false }),
		])

		expect(summary.defectActionability.recurringRendererRuleAdjustmentCount).toBe(0)
		expect(summary.defectActionability.recurringDefects).toEqual([])
	})

	it('allows exactly three recurring renderer-rule defect adjustments before marking them unactionable', () => {
		const recurringDefects = { trial: ['outline-problems', 'noisy-pixel-clusters', 'excessive-internal-edges'] as const, byOption: { A: [], B: [], C: [] } }
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.trialId, { defects: recurringDefects }, { defaultNoneUsable: false }),
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[1]!.trialId, { defects: recurringDefects }, { defaultNoneUsable: false }),
		])

		expect(summary.defectActionability.isSmallActionableDefectSet).toBe(true)
		expect(summary.defectActionability.recurringRendererRuleAdjustmentCount).toBe(3)
	})

	it('marks too many recurring defects unactionable even without a wholesale fixture failure', () => {
		const recurringDefects = { trial: ['outline-problems', 'noisy-pixel-clusters', 'excessive-internal-edges', 'muddy-or-over-busy-lighting'] as const, byOption: { A: [], B: [], C: [] } }
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.trialId, { defects: recurringDefects }, { defaultNoneUsable: false }),
			packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[1]!.trialId, { defects: recurringDefects }, { defaultNoneUsable: false }),
		])

		expect(summary.defectActionability.isSmallActionableDefectSet).toBe(false)
		expect(summary.defectActionability.wholesaleFailedFixtures).toEqual([])
	})

	it('marks the defect set unactionable when too many recurring defects or a fixture fails wholesale', () => {
		const chestTrials = OFFICIAL_BLIND_COMPARISON_TRIALS.filter((trial) => trial.fixture === 'chest')
		const recurringDefects = { trial: ['outline-problems', 'noisy-pixel-clusters', 'excessive-internal-edges', 'muddy-or-over-busy-lighting'] as const, byOption: { A: [], B: [], C: [] } }
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponses(new Map([
				[chestTrials[0]!.trialId, { noneUsable: true, defects: recurringDefects }],
				[chestTrials[1]!.trialId, { noneUsable: true, defects: recurringDefects }],
			]), { defaultNoneUsable: false }),
		])

		expect(summary.defectActionability.isSmallActionableDefectSet).toBe(false)
		expect(summary.defectActionability.recurringRendererRuleAdjustmentCount).toBe(4)
		expect(summary.defectActionability.wholesaleFailedFixtures).toEqual(['chest'])
	})

	it('reports wholesale fixture failures in sorted fixture order', () => {
		const packet = packetWithTrialResponses(new Map(), { defaultNoneUsable: false })
		const failedTrialPackets = packet.trialPackets
			.filter((trialPacket) => ['rover', 'chest'].includes(trialPacket.context.fixture))
			.reverse()
			.map((trialPacket) => ({ ...trialPacket, response: { ...trialPacket.response, noneUsable: true } }))
		const summary = summarizeBlindEvaluationResponses([{ ...packet, trialPackets: failedTrialPackets }])

		expect(summary.defectActionability.wholesaleFailedFixtures).toEqual(['chest', 'rover'])
	})

	it('classifies proceed when one specialized renderer reaches the 70% practical-validation guide with small actionable defects', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithRendererPreferences(['conservative', 'conservative', 'conservative', 'conservative', 'conservative', 'conservative', 'conservative', 'baseline', 'baseline', 'baseline']),
		])

		expect(summary.outcomeGuidance).toMatchObject({
			outcome: 'proceed',
			evidenceStandard: 'practical-validation-not-statistical-proof',
			specializedPreferenceThreshold: 0.7,
			leadingSpecializedRenderer: 'conservative',
			nonNoneUsableJudgmentCount: 10,
		})
		expect(summary.outcomeGuidance.rendererPreferenceShares).toEqual({ baseline: 0.3, conservative: 0.7, full: 0 })
	})

	it('classifies split specialized preference as revise renderer when defects are recurring but scope is not wholesale-failing', () => {
		const recurringDefects = { trial: ['outline-problems', 'noisy-pixel-clusters', 'excessive-internal-edges', 'muddy-or-over-busy-lighting'] as const, byOption: { A: [], B: [], C: [] } }
		const summary = summarizeBlindEvaluationResponses([
			packetWithRendererPreferences(['conservative', 'conservative', 'conservative', 'conservative', 'full', 'full', 'full', 'baseline', 'baseline', 'baseline'], recurringDefects),
		])

		expect(summary.outcomeGuidance.outcome).toBe('revise renderer')
		expect(summary.outcomeGuidance.rationale).toContain('Specialized renderer preference beats or ties baseline after considering conservative/full split preference.')
	})

	it('classifies narrow scope when specialized renderers are competitive but a fixture class fails wholesale', () => {
		const overrides = new Map(OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => [trial.trialId, trial.fixture === 'chest'
			? { noneUsable: true }
			: { ranking: rankingWithFirst(labelForRenderer(trial.trialId, 'full')), noneUsable: false }]))
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponses(overrides, { defaultNoneUsable: false }),
		])

		expect(summary.outcomeGuidance.outcome).toBe('narrow scope')
		expect(summary.outcomeGuidance.noneUsableJudgmentCount).toBe(2)
	})

	it('classifies stop/rethink when baseline wins over combined specialized preference evidence', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithRendererPreferences(['baseline', 'baseline', 'baseline', 'baseline', 'baseline', 'baseline', 'conservative', 'conservative', 'full', 'full']),
		])

		expect(summary.outcomeGuidance).toMatchObject({
			outcome: 'stop/rethink',
			rationale: ['Baseline preference exceeds the combined specialized-renderer preference evidence.'],
		})
	})

	it('classifies stop/rethink when none-usable judgments are common', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithRendererPreferences(['conservative', 'conservative', 'conservative', 'conservative']),
		])

		expect(summary.outcomeGuidance).toMatchObject({
			outcome: 'stop/rethink',
			noneUsableJudgmentCount: 6,
			nonNoneUsableJudgmentCount: 4,
		})
	})

	it('does not treat an equal number of none-usable and usable judgments as common enough to stop', () => {
		const overrides = new Map(OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial, index) => [trial.trialId, {
			ranking: rankingWithFirst(labelForRenderer(trial.trialId, 'conservative')),
			noneUsable: index % 2 === 0,
		}]))
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponses(overrides, { defaultNoneUsable: false }),
		])

		expect(summary.outcomeGuidance).toMatchObject({
			outcome: 'proceed',
			noneUsableJudgmentCount: 5,
			nonNoneUsableJudgmentCount: 5,
		})
	})

	it('classifies stop/rethink when all trials are marked none usable', () => {
		const summary = summarizeBlindEvaluationResponses([
			packetWithTrialResponses(new Map(), { defaultNoneUsable: true }),
		])

		expect(summary.preferenceCounts.totalNonNoneUsableJudgments).toBe(0)
		expect(summary.outcomeGuidance).toMatchObject({
			outcome: 'stop/rethink',
			rendererPreferenceShares: { baseline: 0, conservative: 0, full: 0 },
			leadingSpecializedRenderer: null,
		})
	})

	it('classifies no usable judgments before considering specialized ties', () => {
		const guidance = classifyBlindEvaluationOutcome({
			preferenceCounts: { baseline: 0, conservative: 0, full: 0 },
			defectsByRenderer: {
				baseline: emptyTestDefectCounts(),
				conservative: emptyTestDefectCounts(),
				full: emptyTestDefectCounts(),
			},
			defectActionability: {
				isSmallActionableDefectSet: true,
				recurringRendererRuleAdjustmentCount: 0,
				recurringDefects: [],
				wholesaleFailedFixtures: [],
			},
			totalNonNoneUsableJudgments: 0,
			noneUsableJudgmentCount: 0,
		})

		expect(guidance.outcome).toBe('stop/rethink')
		expect(guidance.rationale).toEqual(['No usable renderer preference judgments remain after excluding none-usable trials.'])
	})

	it('breaks conservative/full preference ties with defect profile rather than renderer complexity', () => {
		const guidance = classifyBlindEvaluationOutcome({
			preferenceCounts: { baseline: 0, conservative: 1, full: 1 },
			defectsByRenderer: {
				baseline: emptyTestDefectCounts(),
				conservative: { ...emptyTestDefectCounts(), 'outline-problems': 1 },
				full: emptyTestDefectCounts(),
			},
			defectActionability: {
				isSmallActionableDefectSet: true,
				recurringRendererRuleAdjustmentCount: 0,
				recurringDefects: [],
				wholesaleFailedFixtures: [],
			},
			totalNonNoneUsableJudgments: 2,
			noneUsableJudgmentCount: 0,
		})

		expect(guidance.leadingSpecializedRenderer).toBe('full')
	})

	it('selects conservative as the leading specialized renderer when its defect profile wins a preference tie', () => {
		const guidance = classifyBlindEvaluationOutcome({
			preferenceCounts: { baseline: 0, conservative: 1, full: 1 },
			defectsByRenderer: {
				baseline: emptyTestDefectCounts(),
				conservative: emptyTestDefectCounts(),
				full: { ...emptyTestDefectCounts(), 'outline-problems': 1 },
			},
			defectActionability: {
				isSmallActionableDefectSet: true,
				recurringRendererRuleAdjustmentCount: 0,
				recurringDefects: [],
				wholesaleFailedFixtures: [],
			},
			totalNonNoneUsableJudgments: 2,
			noneUsableJudgmentCount: 0,
		})

		expect(guidance.leadingSpecializedRenderer).toBe('conservative')
	})

	it('selects full as the leading specialized renderer when its preference count is higher', () => {
		const guidance = classifyBlindEvaluationOutcome({
			preferenceCounts: { baseline: 0, conservative: 1, full: 2 },
			defectsByRenderer: {
				baseline: emptyTestDefectCounts(),
				conservative: emptyTestDefectCounts(),
				full: emptyTestDefectCounts(),
			},
			defectActionability: {
				isSmallActionableDefectSet: true,
				recurringRendererRuleAdjustmentCount: 0,
				recurringDefects: [],
				wholesaleFailedFixtures: [],
			},
			totalNonNoneUsableJudgments: 4,
			noneUsableJudgmentCount: 0,
		})

		expect(guidance.leadingSpecializedRenderer).toBe('full')
		expect(guidance.rendererPreferenceShares.full).toBe(0.5)
	})

	it('keeps specialized renderers competitive when their combined preference ties baseline', () => {
		const guidance = classifyBlindEvaluationOutcome({
			preferenceCounts: { baseline: 2, conservative: 1, full: 1 },
			defectsByRenderer: {
				baseline: emptyTestDefectCounts(),
				conservative: emptyTestDefectCounts(),
				full: emptyTestDefectCounts(),
			},
			defectActionability: {
				isSmallActionableDefectSet: false,
				recurringRendererRuleAdjustmentCount: 4,
				recurringDefects: [],
				wholesaleFailedFixtures: [],
			},
			totalNonNoneUsableJudgments: 4,
			noneUsableJudgmentCount: 0,
		})

		expect(guidance.outcome).toBe('revise renderer')
	})

	it('requires answer keys and packet responses to cover every summarized trial and label', () => {
		const packet = packetWithTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!.trialId, { noneUsable: false })
		const missingTrialAnswerKey = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY.slice(1)
		const incompleteLabelAnswerKey = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY.map((answer, index) => index === 0
			? {
					...answer,
					assignments: answer.assignments.slice(1),
				}
			: answer)
		const incompleteRankingPacket = {
			...packet,
			trialPackets: packet.trialPackets.map((trialPacket, index) => index === 0
				? {
						...trialPacket,
						response: { ...trialPacket.response, ranking: [] },
					}
				: trialPacket),
		}
		const unknownTrialPacket = {
			...packet,
			trialPackets: packet.trialPackets.map((trialPacket, index) => index === 0
				? {
						...trialPacket,
						trialId: 'unknown-trial',
					}
				: trialPacket),
		}
		const unknownTrialAnswerKey = [{ ...OFFICIAL_BLIND_COMPARISON_ANSWER_KEY[0]!, trialId: 'unknown-trial' }, ...OFFICIAL_BLIND_COMPARISON_ANSWER_KEY.slice(1)]

		expect(() => summarizeBlindEvaluationResponses([packet], missingTrialAnswerKey)).toThrowError('Blind evaluation summary requires an answer key for every trial')
		expect(() => summarizeBlindEvaluationResponses([packet], incompleteLabelAnswerKey)).toThrowError('Blind evaluation summary requires answer-key assignments for every label')
		expect(() => summarizeBlindEvaluationResponses([incompleteRankingPacket])).toThrowError('Blind evaluation summary requires complete rankings')
		expect(() => summarizeBlindEvaluationResponses([unknownTrialPacket], unknownTrialAnswerKey)).toThrowError('Blind evaluation summary requires official trial context')
	})
})

function packetWithTrialResponse(
	trialId: string,
	overrides: Partial<ReturnType<typeof createEmptyBlindTrialResponse>>,
	options: { defaultNoneUsable: boolean } = { defaultNoneUsable: true },
): BlindEvaluationResponsePacket {
	return packetWithTrialResponses(new Map([[trialId, overrides]]), options)
}

function packetWithTrialResponses(
	overridesByTrialId: ReadonlyMap<string, Partial<ReturnType<typeof createEmptyBlindTrialResponse>>>,
	options: { defaultNoneUsable: boolean },
): BlindEvaluationResponsePacket {
	const responses = OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => {
		const response = {
			...createEmptyBlindTrialResponse(trial),
			ranking: ['A', 'B', 'C'] as const,
			noneUsable: options.defaultNoneUsable,
		}
		return { ...response, ...overridesByTrialId.get(trial.trialId) }
	})
	return createOfficialBlindEvaluationResponsePacket({
		completedAtIso: '2026-01-15T12:00:00.000Z',
		responses,
	})
}

function emptyTestDefectCounts() {
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
	} as const
}

function packetWithRendererPreferences(
	renderers: ReadonlyArray<OfficialRendererVariantKey>,
	defects?: Partial<ReturnType<typeof createEmptyBlindTrialResponse>>['defects'],
): BlindEvaluationResponsePacket {
	const overrides = new Map(OFFICIAL_BLIND_COMPARISON_TRIALS.slice(0, renderers.length).map((trial, index) => {
		const renderer = renderers[index]
		expect(renderer).toBeDefined()
		return [trial.trialId, {
			ranking: rankingWithFirst(labelForRenderer(trial.trialId, renderer!)),
			noneUsable: false,
			...(defects === undefined ? {} : { defects }),
		}]
	}))
	return packetWithTrialResponses(overrides, { defaultNoneUsable: true })
}

function labelForRenderer(trialId: string, renderer: OfficialRendererVariantKey): BlindComparisonLabel {
	const answer = OFFICIAL_BLIND_COMPARISON_ANSWER_KEY.find((candidate) => candidate.trialId === trialId)
	const assignment = answer?.assignments.find((candidate) => candidate.renderer === renderer)
	expect(assignment).toBeDefined()
	return assignment!.blindLabel
}

function rankingWithFirst(label: BlindComparisonLabel) {
	return [label, ...(['A', 'B', 'C'] as const).filter((candidate) => candidate !== label)]
}
