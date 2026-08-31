import { describe, expect, it } from 'vitest'

import {
	OFFICIAL_ARTIFACT_MATRIX,
	OFFICIAL_FIXTURE_KEYS,
	officialArtifactName,
} from './artifact-matrix'
import { OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX } from './camera-output-preset'
import {
	DEBUG_RENDERER_RULE_TOGGLES,
	OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS,
} from './renderer-variant'

describe('official artifact matrix', () => {
	it('enumerates every official fixture, renderer variant, and camera/output preset combination', () => {
		expect(OFFICIAL_FIXTURE_KEYS).toEqual(['chest', 'chair', 'lantern', 'generator', 'rover'])
		expect(OFFICIAL_ARTIFACT_MATRIX).toHaveLength(
			OFFICIAL_FIXTURE_KEYS.length
			* OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.length
			* OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX.length,
		)

		const uniqueArtifactNames = new Set(OFFICIAL_ARTIFACT_MATRIX.map((entry) => entry.artifactName))
		expect(uniqueArtifactNames.size).toBe(OFFICIAL_ARTIFACT_MATRIX.length)

		for (const fixture of OFFICIAL_FIXTURE_KEYS) {
			for (const renderer of OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS) {
				for (const preset of OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX) {
					expect(OFFICIAL_ARTIFACT_MATRIX).toContainEqual({
						fixture,
						renderer,
						...preset,
						artifactName: officialArtifactName({ fixture, renderer, ...preset }),
					})
				}
			}
		}
	})

	it('encodes fixture, renderer, elevation, size, and direction with official preset keys', () => {
		expect(officialArtifactName({
			fixture: 'chest',
			renderer: 'conservative',
			elevation: 'elev35',
			outputSize: 128,
			direction: 'back-left',
		})).toBe('chest__conservative__elev35__128__back-left.png')
	})

	it('keeps debug renderer outputs out of official artifact combinations', () => {
		expect(Object.keys(DEBUG_RENDERER_RULE_TOGGLES)).toEqual(['lighting-only', 'outline-only', 'cleanup-only'])

		for (const entry of OFFICIAL_ARTIFACT_MATRIX) {
			expect(Object.keys(DEBUG_RENDERER_RULE_TOGGLES)).not.toContain(entry.renderer)
		}
	})

	it('orders artifacts deterministically from official fixture, renderer, and preset registries', () => {
		expect(OFFICIAL_ARTIFACT_MATRIX.slice(0, 4)).toEqual([
			{
				fixture: 'chest',
				renderer: 'baseline',
				direction: 'front-right',
				elevation: 'elev26',
				outputSize: 64,
				artifactName: 'chest__baseline__elev26__64__front-right.png',
			},
			{
				fixture: 'chest',
				renderer: 'baseline',
				direction: 'front-right',
				elevation: 'elev26',
				outputSize: 128,
				artifactName: 'chest__baseline__elev26__128__front-right.png',
			},
			{
				fixture: 'chest',
				renderer: 'baseline',
				direction: 'front-right',
				elevation: 'elev35',
				outputSize: 64,
				artifactName: 'chest__baseline__elev35__64__front-right.png',
			},
			{
				fixture: 'chest',
				renderer: 'baseline',
				direction: 'front-right',
				elevation: 'elev35',
				outputSize: 128,
				artifactName: 'chest__baseline__elev35__128__front-right.png',
			},
		])
		expect(OFFICIAL_ARTIFACT_MATRIX.at(-1)).toEqual({
			fixture: 'rover',
			renderer: 'full',
			direction: 'front-left',
			elevation: 'elev35',
			outputSize: 128,
			artifactName: 'rover__full__elev35__128__front-left.png',
		})
	})
})
