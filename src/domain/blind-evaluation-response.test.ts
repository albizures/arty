import { describe, expect, it } from 'vitest'

import { OFFICIAL_BLIND_EVALUATION_PROTOCOL } from './blind-evaluation-protocol'
import {
	assertCompleteBlindTrialResponse,
	createEmptyBlindTrialResponse,
	createEmptyOfficialBlindEvaluationResponsePacket,
	createEmptyOfficialBlindEvaluationResponses,
	createOfficialBlindEvaluationResponsePacket,
} from './blind-evaluation-response'
import { OFFICIAL_BLIND_COMPARISON_TRIALS } from './comparison-evaluation-manifest'

describe('blind evaluation trial responses', () => {
	it('exports a complete response packet with non-identifying protocol and trial context', () => {
		const responses = completedOfficialResponses()

		const packet = createOfficialBlindEvaluationResponsePacket({
			evaluatorSessionId: 'target-user-03',
			completedAtIso: '2026-01-15T12:00:00.000Z',
			responses,
		})

		expect(packet).toMatchObject({
			packetKind: 'phase-0-blind-evaluation-response-packet',
			protocol: {
				participantOutputSize: 64,
				fixtureCount: 5,
				elevationCount: 2,
				defectTaxonomy: OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy,
			},
			evaluatorSessionId: 'target-user-03',
			completedAtIso: '2026-01-15T12:00:00.000Z',
		})
		expect(packet.protocol.ratingQuestionKeys).toEqual([
			'rank-most-usable-as-pixel-art-game-prop-sprites',
			'none-usable',
			'observed-defects',
			'cleanup-notes',
		])
		expect(packet.trialPackets).toHaveLength(OFFICIAL_BLIND_COMPARISON_TRIALS.length)
		expect(packet.trialPackets[0]).toEqual({
			trialId: 'chest__elev26__64',
			context: {
				fixture: 'chest',
				elevation: 'elev26',
				outputSize: 64,
				directions: ['front-right', 'back-right', 'back-left', 'front-left'],
				optionLabels: ['A', 'B', 'C'],
			},
			response: responses[0],
		})
		expect(JSON.stringify(packet)).not.toContain('baseline')
		expect(JSON.stringify(packet)).not.toContain('conservative')
		expect(JSON.stringify(packet)).not.toContain('full')
	})

	it('exports complete response packets without participant identity metadata', () => {
		const packet = createOfficialBlindEvaluationResponsePacket({
			completedAtIso: '2026-01-15T12:00:00.000Z',
			responses: completedOfficialResponses(),
		})

		expect(packet.evaluatorSessionId).toBe('')
	})

	it('exports an empty official response packet template for persistence wiring', () => {
		const packet = createEmptyOfficialBlindEvaluationResponsePacket()

		expect(packet.evaluatorSessionId).toBe('')
		expect(packet.completedAtIso).toBe('')
		expect(packet.trialPackets).toHaveLength(OFFICIAL_BLIND_COMPARISON_TRIALS.length)
		expect(packet.trialPackets[0]?.response).toMatchObject({
			trialId: 'chest__elev26__64',
			ranking: [],
			noneUsable: false,
		})
		expect(JSON.stringify(packet)).not.toContain('baseline')
	})

	it('rejects incomplete response packet exports', () => {
		const completeResponses = completedOfficialResponses()
		const duplicateFirstTrial = [completeResponses[0]!, ...completeResponses.slice(0, -1)]

		expect(() => createOfficialBlindEvaluationResponsePacket({
			completedAtIso: '2026-01-15T12:00:00.000Z',
			responses: completeResponses.slice(1),
		})).toThrowError('Blind evaluation response packet must contain exactly one complete response for every official trial')
		expect(() => createOfficialBlindEvaluationResponsePacket({
			completedAtIso: '2026-01-15T12:00:00.000Z',
			responses: duplicateFirstTrial,
		})).toThrowError('Blind evaluation response packet must contain exactly one complete response for every official trial')
		expect(() => createOfficialBlindEvaluationResponsePacket({
			completedAtIso: 'not-a-date',
			responses: completeResponses,
		})).toThrowError('Blind evaluation response packet must contain ISO completion metadata')
		expect(() => createOfficialBlindEvaluationResponsePacket({
			completedAtIso: 123 as unknown as string,
			responses: completeResponses,
		})).toThrowError('Blind evaluation response packet must contain ISO completion metadata')
		expect(() => createOfficialBlindEvaluationResponsePacket({
			completedAtIso: '2026-01-15T12:00:00Z',
			responses: completeResponses,
		})).toThrowError('Blind evaluation response packet must contain ISO completion metadata')
		expect(() => createOfficialBlindEvaluationResponsePacket({
			completedAtIso: '2026-01-15T12:00:00.000Z',
			responses: completeResponses.map((response, index) => index === 0 ? { ...response, cleanupNotes: { length: 0 } as unknown as string } : response),
		})).toThrowError('Blind evaluation response must use the official trial response format')
	})

	it('creates one response capture slot for every official blind trial', () => {
		const responses = createEmptyOfficialBlindEvaluationResponses()

		expect(responses).toHaveLength(OFFICIAL_BLIND_COMPARISON_TRIALS.length)
		expect(responses.map((response) => response.trialId)).toEqual(
			OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => trial.trialId),
		)
		expect(responses[0]).toMatchObject({
			trialId: 'chest__elev26__64',
			ranking: [],
			noneUsable: false,
			defects: {
				trial: [],
				byOption: { A: [], B: [], C: [] },
			},
			cleanupNotes: '',
		})
	})

	it('accepts complete ranking, none-usable, defect, and cleanup-note answers for an official trial', () => {
		const response = {
			...createEmptyBlindTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!),
			ranking: ['B', 'A', 'C'],
			noneUsable: true,
			defects: {
				trial: ['inconsistent-appearance-across-views'],
				byOption: {
					A: ['weak-or-unclear-silhouette'],
					B: [],
					C: ['other-free-text'],
				},
			},
			cleanupNotes: 'Option C would need outline cleanup.',
		}

		expect(() => assertCompleteBlindTrialResponse(response)).not.toThrow()
	})

	it('uses the official fixed defect taxonomy for response validation', () => {
		expect(OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy).toContain('muddy-or-over-busy-lighting')
		expect(() => assertCompleteBlindTrialResponse({
			...createEmptyBlindTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!),
			ranking: ['A', 'B', 'C'],
			defects: {
				trial: ['made-up-defect'],
				byOption: { A: [], B: [], C: [] },
			},
		})).toThrowError('Blind evaluation response must use the official trial response format')
	})

	it('rejects incomplete or malformed trial responses', () => {
		const valid = {
			...createEmptyBlindTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!),
			ranking: ['A', 'B', 'C'],
		}

		const malformedResponses = [
			null,
			[],
			{ ...valid, unexpected: true },
			{ ...valid, trialId: 'custom-trial' },
			{ ...valid, ranking: 'ABC' },
			{ ...valid, ranking: ['A', 'B'] },
			{ ...valid, ranking: ['A', 'A', 'C'] },
			{ ...valid, ranking: ['A', 'B', 'D'] },
			{ ...valid, ranking: ['A', 'B', 'C', 'A'] },
			{ ...valid, noneUsable: 'false' },
			{ ...valid, defects: null },
			{ ...valid, defects: [] },
			{ ...valid, defects: { trial: [], byOption: { A: [], B: [], C: [] }, renderer: 'baseline' } },
			{ ...valid, defects: { trial: [], byOption: [] } },
			{ ...valid, defects: { trial: [], byOption: { A: [], B: [] } } },
			{ ...valid, defects: { trial: [], byOption: { A: [], B: [], C: [], D: [] } } },
			{ ...valid, defects: { trial: [], byOption: { A: ['outline-problems'], B: [], C: ['debug-defect'] } } },
			{ ...valid, cleanupNotes: 123 },
			{ ...valid, cleanupNotes: { length: 0 } },
			{ ...valid, cleanupNotes: 'x'.repeat(501) },
		]

		for (const malformedResponse of malformedResponses) {
			expect(() => assertCompleteBlindTrialResponse(malformedResponse)).toThrowError(
				'Blind evaluation response must use the official trial response format',
			)
		}
	})

	it('accepts boundary-valid response and completion metadata', () => {
		const response = {
			...createEmptyBlindTrialResponse(OFFICIAL_BLIND_COMPARISON_TRIALS[0]!),
			ranking: ['A', 'B', 'C'] as const,
			cleanupNotes: 'x'.repeat(500),
		}

		expect(() => assertCompleteBlindTrialResponse(response)).not.toThrow()
		expect(createOfficialBlindEvaluationResponsePacket({
			completedAtIso: '2026-01-15T12:00:00.000Z',
			responses: completedOfficialResponses(),
		}).completedAtIso).toBe('2026-01-15T12:00:00.000Z')
	})
})

function completedOfficialResponses() {
	return OFFICIAL_BLIND_COMPARISON_TRIALS.map((trial) => ({
		...createEmptyBlindTrialResponse(trial),
		ranking: ['A', 'B', 'C'] as const,
		defects: {
			trial: trial.fixture === 'chest' ? ['outline-problems' as const] : [],
			byOption: { A: [], B: [], C: [] },
		},
		cleanupNotes: trial.fixture === 'chest' ? 'Outline cleanup may help.' : '',
	}))
}
