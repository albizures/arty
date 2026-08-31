import { assert } from '../utils/error'

export type CameraDirectionPresetKey = 'front-right' | 'back-right' | 'back-left' | 'front-left'
export type CameraElevationPresetKey = 'elev26' | 'elev35'
export type OutputSizePresetKey = 64 | 128

type CameraDirectionPreset = {
	key: CameraDirectionPresetKey
	projection: 'orthographic'
}

type CameraElevationPreset = {
	key: CameraElevationPresetKey
	degrees: number
	meaning: string
}

type OutputSizePreset = {
	key: OutputSizePresetKey
	width: OutputSizePresetKey
	height: OutputSizePresetKey
	purpose: 'primary-game-scale-acceptance' | 'diagnostic-detail-inspection'
}

export type CameraOutputPresetSelection = {
	direction: CameraDirectionPresetKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
}

export const OFFICIAL_CAMERA_DIRECTION_PRESETS = [
	{ key: 'front-right', projection: 'orthographic' },
	{ key: 'back-right', projection: 'orthographic' },
	{ key: 'back-left', projection: 'orthographic' },
	{ key: 'front-left', projection: 'orthographic' },
] as const satisfies ReadonlyArray<CameraDirectionPreset>

export const OFFICIAL_CAMERA_ELEVATION_PRESETS = [
	{ key: 'elev26', degrees: 26.565, meaning: 'low-isometric-ish-output' },
	{ key: 'elev35', degrees: 35, meaning: 'higher-three-quarter-output' },
] as const satisfies ReadonlyArray<CameraElevationPreset>

export const OFFICIAL_OUTPUT_SIZE_PRESETS = [
	{ key: 64, width: 64, height: 64, purpose: 'primary-game-scale-acceptance' },
	{ key: 128, width: 128, height: 128, purpose: 'diagnostic-detail-inspection' },
] as const satisfies ReadonlyArray<OutputSizePreset>

export const OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX = OFFICIAL_CAMERA_DIRECTION_PRESETS.flatMap((direction) => {
	return OFFICIAL_CAMERA_ELEVATION_PRESETS.flatMap((elevation) => {
		return OFFICIAL_OUTPUT_SIZE_PRESETS.map((outputSize) => ({
			direction: direction.key,
			elevation: elevation.key,
			outputSize: outputSize.key,
		}))
	})
}) satisfies ReadonlyArray<CameraOutputPresetSelection>

const CAMERA_DIRECTION_PRESET_KEYS: ReadonlySet<unknown> = new Set(OFFICIAL_CAMERA_DIRECTION_PRESETS.map((preset) => preset.key))
const CAMERA_ELEVATION_PRESET_KEYS: ReadonlySet<unknown> = new Set(OFFICIAL_CAMERA_ELEVATION_PRESETS.map((preset) => preset.key))
const OUTPUT_SIZE_PRESET_KEYS: ReadonlySet<unknown> = new Set(OFFICIAL_OUTPUT_SIZE_PRESETS.map((preset) => preset.key))

const OFFICIAL_SELECTION_KEYS = new Set(['direction', 'elevation', 'outputSize'])

function isOfficialCameraDirectionPresetKey(value: unknown): value is CameraDirectionPresetKey {
	return CAMERA_DIRECTION_PRESET_KEYS.has(value)
}

function isOfficialCameraElevationPresetKey(value: unknown): value is CameraElevationPresetKey {
	return CAMERA_ELEVATION_PRESET_KEYS.has(value)
}

function isOfficialOutputSizePresetKey(value: unknown): value is OutputSizePresetKey {
	return OUTPUT_SIZE_PRESET_KEYS.has(value)
}

export function isOfficialCameraOutputPresetSelection(value: unknown): value is CameraOutputPresetSelection {
	if (!isRecord(value)) {
		return false
	}

	return Object.keys(value).every((key) => OFFICIAL_SELECTION_KEYS.has(key))
		&& isOfficialCameraDirectionPresetKey(value.direction)
		&& isOfficialCameraElevationPresetKey(value.elevation)
		&& isOfficialOutputSizePresetKey(value.outputSize)
}

export function assertOfficialCameraOutputPresetSelection(value: unknown): asserts value is CameraOutputPresetSelection {
	assert(isOfficialCameraOutputPresetSelection(value), 'Phase 0 camera/output must use an official named preset selection')
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
