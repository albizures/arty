import type { CameraDirectionPresetKey, CameraElevationPresetKey, OutputSizePresetKey } from './camera-output-preset'
import type { OfficialRendererVariantKey } from './renderer-variant'

import { OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX } from './camera-output-preset'
import { OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS } from './renderer-variant'

export type OfficialFixtureKey = 'chest' | 'chair' | 'lantern' | 'generator' | 'rover'

export type OfficialArtifactMatrixEntry = {
	fixture: OfficialFixtureKey
	renderer: OfficialRendererVariantKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	direction: CameraDirectionPresetKey
	artifactName: string
}

export const OFFICIAL_FIXTURE_KEYS = [
	'chest',
	'chair',
	'lantern',
	'generator',
	'rover',
] as const satisfies ReadonlyArray<OfficialFixtureKey>

export const OFFICIAL_ARTIFACT_MATRIX = OFFICIAL_FIXTURE_KEYS.flatMap((fixture) => {
	return OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.flatMap((renderer) => {
		return OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX.map((preset) => officialArtifactMatrixEntry({
			fixture,
			renderer,
			...preset,
		}))
	})
}) satisfies ReadonlyArray<OfficialArtifactMatrixEntry>

export function officialArtifactName(selection: Omit<OfficialArtifactMatrixEntry, 'artifactName'>): string {
	return `${selection.fixture}__${selection.renderer}__${selection.elevation}__${selection.outputSize}__${selection.direction}.png`
}

function officialArtifactMatrixEntry(selection: Omit<OfficialArtifactMatrixEntry, 'artifactName'>): OfficialArtifactMatrixEntry {
	return {
		...selection,
		artifactName: officialArtifactName(selection),
	}
}
