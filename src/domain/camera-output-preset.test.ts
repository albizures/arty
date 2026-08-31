import { describe, expect, it } from 'vitest'

import {
	assertOfficialCameraOutputPresetSelection,
	isOfficialCameraOutputPresetSelection,
	OFFICIAL_CAMERA_DIRECTION_PRESETS,
	OFFICIAL_CAMERA_ELEVATION_PRESETS,
	OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX,
	OFFICIAL_OUTPUT_SIZE_PRESETS,
} from './camera-output-preset'

describe('official camera/output presets', () => {
	it('exposes exactly four orthographic direction presets', () => {
		expect(OFFICIAL_CAMERA_DIRECTION_PRESETS).toEqual([
			{ key: 'front-right', projection: 'orthographic' },
			{ key: 'back-right', projection: 'orthographic' },
			{ key: 'back-left', projection: 'orthographic' },
			{ key: 'front-left', projection: 'orthographic' },
		])
	})

	it('exposes exactly the two Phase 0 elevation candidates', () => {
		expect(OFFICIAL_CAMERA_ELEVATION_PRESETS).toEqual([
			{ key: 'elev26', degrees: 26.565, meaning: 'low-isometric-ish-output' },
			{ key: 'elev35', degrees: 35, meaning: 'higher-three-quarter-output' },
		])
	})

	it('exposes exactly the two square output-size presets with their roles', () => {
		expect(OFFICIAL_OUTPUT_SIZE_PRESETS).toEqual([
			{ key: 64, width: 64, height: 64, purpose: 'primary-game-scale-acceptance' },
			{ key: 128, width: 128, height: 128, purpose: 'diagnostic-detail-inspection' },
		])
	})

	it('enumerates the complete direction/elevation/output-size matrix deterministically', () => {
		expect(OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX).toHaveLength(16)
		expect(OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX).toEqual([
			{ direction: 'front-right', elevation: 'elev26', outputSize: 64 },
			{ direction: 'front-right', elevation: 'elev26', outputSize: 128 },
			{ direction: 'front-right', elevation: 'elev35', outputSize: 64 },
			{ direction: 'front-right', elevation: 'elev35', outputSize: 128 },
			{ direction: 'back-right', elevation: 'elev26', outputSize: 64 },
			{ direction: 'back-right', elevation: 'elev26', outputSize: 128 },
			{ direction: 'back-right', elevation: 'elev35', outputSize: 64 },
			{ direction: 'back-right', elevation: 'elev35', outputSize: 128 },
			{ direction: 'back-left', elevation: 'elev26', outputSize: 64 },
			{ direction: 'back-left', elevation: 'elev26', outputSize: 128 },
			{ direction: 'back-left', elevation: 'elev35', outputSize: 64 },
			{ direction: 'back-left', elevation: 'elev35', outputSize: 128 },
			{ direction: 'front-left', elevation: 'elev26', outputSize: 64 },
			{ direction: 'front-left', elevation: 'elev26', outputSize: 128 },
			{ direction: 'front-left', elevation: 'elev35', outputSize: 64 },
			{ direction: 'front-left', elevation: 'elev35', outputSize: 128 },
		])
	})

	it('accepts only named Phase 0 preset selections', () => {
		expect(isOfficialCameraOutputPresetSelection({
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})).toBe(true)

		expect(isOfficialCameraOutputPresetSelection({ direction: 'side', elevation: 'elev26', outputSize: 64 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection({ direction: 'front-right', elevation: 26.565, outputSize: 64 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection({ direction: 'front-right', elevation: 'elev26', outputSize: 96 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection({ direction: 'front-right', elevation: 'side', outputSize: 64 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection(null)).toBe(false)
		expect(isOfficialCameraOutputPresetSelection(undefined)).toBe(false)
		expect(isOfficialCameraOutputPresetSelection(['front-right', 'elev26', 64])).toBe(false)
	})

	it('keeps preset-key checks narrow for primitive values', () => {
		expect(isOfficialCameraOutputPresetSelection({ direction: 64, elevation: 'elev26', outputSize: 64 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection({ direction: 'front-right', elevation: 'front-right', outputSize: 64 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection({ direction: 'front-right', elevation: 26.565, outputSize: 64 })).toBe(false)
		expect(isOfficialCameraOutputPresetSelection({ direction: 'front-right', elevation: 'elev26', outputSize: '64' })).toBe(false)
	})

	it('rejects arbitrary camera controls and unnamed output options', () => {
		const arbitraryRequests = [
			{ direction: 'front-right', elevation: 'elev26', outputSize: 64, angle: 45 },
			{ direction: 'front-right', elevation: 'elev26', outputSize: 64, zoom: 2 },
			{ direction: 'front-right', elevation: 'elev26', outputSize: 64, focalLength: 50 },
			{ direction: 'front-right', elevation: 'elev26', outputSize: 64, canvasSize: { width: 64, height: 128 } },
			{ direction: 'front-right', elevation: 'elev26', outputSize: 64, camera: 'custom' },
		]

		for (const request of arbitraryRequests) {
			expect(isOfficialCameraOutputPresetSelection(request)).toBe(false)
			expect(() => assertOfficialCameraOutputPresetSelection(request)).toThrowError('Phase 0 camera/output must use an official named preset selection')
		}
	})
})
