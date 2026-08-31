import type { OfficialFixtureKey } from './artifact-matrix'
import type { CameraDirectionPresetKey, CameraElevationPresetKey, OutputSizePresetKey } from './camera-output-preset'
import type { GeneratedOfficialPngArtifact } from './official-artifact-generator'
import type { OfficialRendererVariantKey } from './renderer-variant'

import { inflateSync } from 'node:zlib'

import { OFFICIAL_CAMERA_DIRECTION_PRESETS } from './camera-output-preset'
import { encodeRgbaPng } from './official-artifact-generator'
import { OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS } from './renderer-variant'

export type SpriteSheetArtifact = {
	fixture: OfficialFixtureKey
	renderer: OfficialRendererVariantKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	artifactName: string
	path: string
	png: Uint8Array
	transparentBackground: true
	directions: ReadonlyArray<CameraDirectionPresetKey>
	sourceArtifactNames: ReadonlyArray<string>
}

export type InternalContactSheetArtifact = {
	fixture: OfficialFixtureKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	artifactName: string
	path: string
	png: Uint8Array
	stimulusRole: 'internal-debug-not-blind-stimulus'
	labelsRevealRendererIdentity: true
	cells: ReadonlyArray<InternalContactSheetCell>
}

type InternalContactSheetCell = {
	label: string
	renderer: OfficialRendererVariantKey
	direction: CameraDirectionPresetKey
	sourceArtifactName: string
}

export type GenerateSpriteSheetsRequest = {
	artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>
	outputDirectory: string
	writeArtifact?: (artifact: SpriteSheetArtifact) => void | Promise<void>
}

export type GenerateInternalContactSheetsRequest = {
	artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>
	outputDirectory: string
	writeArtifact?: (artifact: InternalContactSheetArtifact) => void | Promise<void>
}

const BYTES_PER_RGBA_PIXEL = 4
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const

export async function generateSpriteSheets(request: GenerateSpriteSheetsRequest): Promise<ReadonlyArray<SpriteSheetArtifact>> {
	const spriteSheets = spriteSheetGroups(request.artifacts).map((group) => buildSpriteSheet(group, request.outputDirectory))

	for (const spriteSheet of spriteSheets) {
		await request.writeArtifact?.(spriteSheet)
	}

	return spriteSheets
}

export async function generateInternalContactSheets(
	request: GenerateInternalContactSheetsRequest,
): Promise<ReadonlyArray<InternalContactSheetArtifact>> {
	const contactSheets = contactSheetGroups(request.artifacts).map((group) => buildInternalContactSheet(group, request.outputDirectory))

	for (const contactSheet of contactSheets) {
		await request.writeArtifact?.(contactSheet)
	}

	return contactSheets
}

function buildSpriteSheet(group: SpriteSheetGroup, outputDirectory: string): SpriteSheetArtifact {
	const width = group.outputSize * OFFICIAL_CAMERA_DIRECTION_PRESETS.length
	const height = group.outputSize
	const pixels = new Uint8ClampedArray(width * height * BYTES_PER_RGBA_PIXEL)
	const orderedArtifacts = OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => requireArtifact(
		group.artifacts,
		group,
		direction.key,
	))

	for (const [column, artifact] of orderedArtifacts.entries()) {
		copyPngIntoSheet(artifact.png, pixels, {
			targetWidth: width,
			targetX: column * group.outputSize,
			targetY: 0,
			expectedSourceSize: group.outputSize,
		})
	}

	const artifactName = `${group.fixture}__${group.renderer}__${group.elevation}__${group.outputSize}__sprite-sheet.png`
	return {
		fixture: group.fixture,
		renderer: group.renderer,
		elevation: group.elevation,
		outputSize: group.outputSize,
		artifactName,
		path: joinArtifactPath(outputDirectory, artifactName),
		png: encodeRgbaPng(width, height, pixels),
		transparentBackground: true,
		directions: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => direction.key),
		sourceArtifactNames: orderedArtifacts.map((artifact) => artifact.artifactName),
	}
}

function buildInternalContactSheet(group: ContactSheetGroup, outputDirectory: string): InternalContactSheetArtifact {
	const width = group.outputSize * OFFICIAL_CAMERA_DIRECTION_PRESETS.length
	const height = group.outputSize * OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.length
	const pixels = new Uint8ClampedArray(width * height * BYTES_PER_RGBA_PIXEL)
	const cells: Array<InternalContactSheetCell> = []

	for (const [row, renderer] of OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.entries()) {
		for (const [column, direction] of OFFICIAL_CAMERA_DIRECTION_PRESETS.entries()) {
			const artifact = requireContactArtifact(group.artifacts, group, renderer, direction.key)
			copyPngIntoSheet(artifact.png, pixels, {
				targetWidth: width,
				targetX: column * group.outputSize,
				targetY: row * group.outputSize,
				expectedSourceSize: group.outputSize,
			})
			cells.push({
				label: `${renderer} / ${direction.key}`,
				renderer,
				direction: direction.key,
				sourceArtifactName: artifact.artifactName,
			})
		}
	}

	const artifactName = `${group.fixture}__internal-contact__${group.elevation}__${group.outputSize}.png`
	return {
		fixture: group.fixture,
		elevation: group.elevation,
		outputSize: group.outputSize,
		artifactName,
		path: joinArtifactPath(outputDirectory, artifactName),
		png: encodeRgbaPng(width, height, pixels),
		stimulusRole: 'internal-debug-not-blind-stimulus',
		labelsRevealRendererIdentity: true,
		cells,
	}
}

type SpriteSheetGroup = {
	fixture: OfficialFixtureKey
	renderer: OfficialRendererVariantKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>
}

type ContactSheetGroup = {
	fixture: OfficialFixtureKey
	elevation: CameraElevationPresetKey
	outputSize: OutputSizePresetKey
	artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>
}

function spriteSheetGroups(artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>): ReadonlyArray<SpriteSheetGroup> {
	const groups = new Map<string, Array<GeneratedOfficialPngArtifact>>()
	for (const artifact of artifacts) {
		const key = [artifact.fixture, artifact.renderer, artifact.elevation, artifact.outputSize].join('\0')
		groups.set(key, [...groups.get(key) ?? [], artifact])
	}

	return Array.from(groups.values()).map((groupArtifacts) => {
		const firstArtifact = groupArtifacts[0] as GeneratedOfficialPngArtifact

		return {
			fixture: firstArtifact.fixture,
			renderer: firstArtifact.renderer,
			elevation: firstArtifact.elevation,
			outputSize: firstArtifact.outputSize,
			artifacts: groupArtifacts,
		}
	})
}

function contactSheetGroups(artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>): ReadonlyArray<ContactSheetGroup> {
	const groups = new Map<string, Array<GeneratedOfficialPngArtifact>>()
	for (const artifact of artifacts) {
		const key = [artifact.fixture, artifact.elevation, artifact.outputSize].join('\0')
		groups.set(key, [...groups.get(key) ?? [], artifact])
	}

	return Array.from(groups.values()).map((groupArtifacts) => {
		const firstArtifact = groupArtifacts[0] as GeneratedOfficialPngArtifact

		return {
			fixture: firstArtifact.fixture,
			elevation: firstArtifact.elevation,
			outputSize: firstArtifact.outputSize,
			artifacts: groupArtifacts,
		}
	})
}

function requireArtifact(
	artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>,
	group: SpriteSheetGroup,
	direction: CameraDirectionPresetKey,
): GeneratedOfficialPngArtifact {
	const artifact = artifacts.find((candidate) => candidate.direction === direction)
	if (artifact === undefined) {
		throw new Error(
			`Missing direction '${direction}' for sprite sheet ${group.fixture}/${group.renderer}/${group.elevation}/${group.outputSize}.`,
		)
	}
	return artifact
}

function requireContactArtifact(
	artifacts: ReadonlyArray<GeneratedOfficialPngArtifact>,
	group: ContactSheetGroup,
	renderer: OfficialRendererVariantKey,
	direction: CameraDirectionPresetKey,
): GeneratedOfficialPngArtifact {
	const artifact = artifacts.find((candidate) => candidate.renderer === renderer && candidate.direction === direction)
	if (artifact === undefined) {
		throw new Error(
			`Missing ${renderer}/${direction} for contact sheet ${group.fixture}/${group.elevation}/${group.outputSize}.`,
		)
	}
	return artifact
}

function copyPngIntoSheet(
	png: Uint8Array,
	targetPixels: Uint8ClampedArray,
	options: { targetWidth: number, targetX: number, targetY: number, expectedSourceSize: number },
): void {
	const source = decodeRgbaPng(png)
	if (source.width !== options.expectedSourceSize || source.height !== options.expectedSourceSize) {
		throw new Error(`Expected ${options.expectedSourceSize}×${options.expectedSourceSize} PNG source.`)
	}

	for (let row = 0; row < source.height; row += 1) {
		const sourceOffset = row * source.width * BYTES_PER_RGBA_PIXEL
		const targetOffset = ((options.targetY + row) * options.targetWidth + options.targetX) * BYTES_PER_RGBA_PIXEL
		targetPixels.set(source.pixels.subarray(sourceOffset, sourceOffset + source.width * BYTES_PER_RGBA_PIXEL), targetOffset)
	}
}

function decodeRgbaPng(png: Uint8Array): { width: number, height: number, pixels: Uint8ClampedArray } {
	assertPngSignature(png)
	const chunks = pngChunks(png)
	const metadata = pngMetadata(chunks)
	assertRgbaMetadata(metadata)

	return {
		width: metadata.width,
		height: metadata.height,
		pixels: unfilteredRgbaPixels(chunks, metadata),
	}
}

function assertPngSignature(png: Uint8Array): void {
	if (!PNG_SIGNATURE.every((byte, index) => png[index] === byte)) {
		throw new Error('Only PNG sources can be assembled.')
	}
}

function pngMetadata(chunks: ReadonlyArray<{ type: string, data: Uint8Array }>): {
	width: number
	height: number
	bitDepth: number | undefined
	colorType: number | undefined
} {
	const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')?.data
	if (ihdr === undefined) {
		throw new Error('PNG source is missing IHDR.')
	}

	const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength)
	return {
		width: view.getUint32(0),
		height: view.getUint32(4),
		bitDepth: ihdr[8],
		colorType: ihdr[9],
	}
}

function assertRgbaMetadata(metadata: { bitDepth: number | undefined, colorType: number | undefined }): void {
	if (metadata.bitDepth !== 8 || metadata.colorType !== 6) {
		throw new Error('Only 8-bit RGBA PNG sources can be assembled.')
	}
}

function unfilteredRgbaPixels(
	chunks: ReadonlyArray<{ type: string, data: Uint8Array }>,
	metadata: { width: number, height: number },
): Uint8ClampedArray {
	const inflated = inflateSync(concatenateUint8Arrays(
		chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data),
	))
	const rowBytes = metadata.width * BYTES_PER_RGBA_PIXEL
	const pixels = new Uint8ClampedArray(metadata.width * metadata.height * BYTES_PER_RGBA_PIXEL)

	for (let row = 0; row < metadata.height; row += 1) {
		copyUnfilteredRow(inflated, pixels, row, rowBytes)
	}

	return pixels
}

function copyUnfilteredRow(inflated: Uint8Array, pixels: Uint8ClampedArray, row: number, rowBytes: number): void {
	const scanlineOffset = row * (rowBytes + 1)
	if (inflated[scanlineOffset] !== 0) {
		throw new Error('Only unfiltered PNG scanlines can be assembled.')
	}
	pixels.set(inflated.subarray(scanlineOffset + 1, scanlineOffset + 1 + rowBytes), row * rowBytes)
}

function pngChunks(png: Uint8Array): Array<{ type: string, data: Uint8Array }> {
	// Stryker disable next-line ArrayDeclaration: seeding this parser accumulator is invalid internal state, not caller-observable behavior.
	const chunks = new Array<{ type: string, data: Uint8Array }>()
	let offset = PNG_SIGNATURE.length

	while (offset < png.length) {
		const view = new DataView(png.buffer, png.byteOffset + offset)
		const length = view.getUint32(0)
		const type = String.fromCharCode(...png.slice(offset + 4, offset + 8))
		chunks.push({ type, data: png.slice(offset + 8, offset + 8 + length) })
		offset += length + 12
	}

	return chunks
}

function concatenateUint8Arrays(arrays: ReadonlyArray<Uint8Array>): Uint8Array {
	const result = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0))
	let offset = 0
	for (const array of arrays) {
		result.set(array, offset)
		offset += array.length
	}
	return result
}

function joinArtifactPath(outputDirectory: string, artifactName: string): string {
	return `${outputDirectory.replace(/\/$/, '')}/${artifactName}`
}
