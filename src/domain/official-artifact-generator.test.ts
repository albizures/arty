import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { OFFICIAL_ARTIFACT_MATRIX, OFFICIAL_FIXTURE_KEYS, officialArtifactName } from './artifact-matrix'
import { OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX } from './camera-output-preset'
import { encodeRgbaPng, generateOfficialPngArtifacts } from './official-artifact-generator'
import { OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS } from './renderer-variant'
import { parseVoxprop } from './voxel-model-dsl'

const FIXTURE_MODELS = OFFICIAL_FIXTURE_KEYS.map((fixture) => {
	const parseResult = parseVoxprop(fixtureText(fixture))
	if (parseResult.kind === 'invalid-voxprop') {
		throw new Error(`Fixture '${fixture}' failed to parse.`)
	}

	return { fixture, model: parseResult.data }
})

describe('generateOfficialPngArtifacts', () => {
	it('writes one transparent PNG for every official fixture, renderer, elevation, size, and direction combination', async () => {
		const writtenPaths: Array<string> = []
		const artifacts = await generateOfficialPngArtifacts({
			fixtureModels: FIXTURE_MODELS,
			outputDirectory: 'reports/phase-0-official-artifacts',
			writeArtifact: (artifact) => {
				writtenPaths.push(artifact.path)
			},
		})

		expect(artifacts).toHaveLength(
			OFFICIAL_FIXTURE_KEYS.length
			* OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.length
			* OFFICIAL_CAMERA_OUTPUT_PRESET_MATRIX.length,
		)
		expect(artifacts).toHaveLength(OFFICIAL_ARTIFACT_MATRIX.length)
		expect(writtenPaths).toEqual(artifacts.map((artifact) => artifact.path))

		for (const matrixEntry of OFFICIAL_ARTIFACT_MATRIX) {
			const artifact = artifacts.find((candidate) => candidate.artifactName === matrixEntry.artifactName)
			expect(artifact).toMatchObject({
				...matrixEntry,
				path: `reports/phase-0-official-artifacts/${matrixEntry.artifactName}`,
				transparentBackground: true,
			})
			expect(artifact?.png.slice(0, 8)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
			expect(pngChunkTypes(artifact?.png ?? new Uint8Array()).at(-1)).toBe('IEND')
			expect(pngDimensions(artifact?.png ?? new Uint8Array())).toEqual({ width: matrixEntry.outputSize, height: matrixEntry.outputSize })
			expect(pngChunksHaveValidCrcs(artifact?.png ?? new Uint8Array())).toBe(true)
			expect(pngHasTransparentAndOpaquePixels(artifact?.png ?? new Uint8Array())).toBe(true)
		}
	})

	it('uses deterministic sortable artifact names and excludes debug renderer outputs', async () => {
		const artifacts = await generateOfficialPngArtifacts({
			fixtureModels: FIXTURE_MODELS,
			outputDirectory: 'artifacts/',
			writeArtifact: () => undefined,
		})

		expect(artifacts[0]?.path).toBe('artifacts/chest__baseline__elev26__64__front-right.png')
		expect(artifacts[0]?.artifactName).toBe('chest__baseline__elev26__64__front-right.png')
		expect(artifacts.at(-1)?.artifactName).toBe('rover__full__elev35__128__front-left.png')
		expect(artifacts).toContainEqual(expect.objectContaining({
			artifactName: officialArtifactName({
				fixture: 'chest',
				renderer: 'full',
				elevation: 'elev26',
				outputSize: 64,
				direction: 'front-right',
			}),
		}))
		expect(artifacts.map((artifact) => artifact.renderer)).not.toContain('lighting-only')
		expect(artifacts.map((artifact) => artifact.renderer)).not.toContain('outline-only')
		expect(artifacts.map((artifact) => artifact.renderer)).not.toContain('cleanup-only')
	})

	it('rejects incomplete official fixture input instead of silently skipping matrix cells', async () => {
		await expect(generateOfficialPngArtifacts({
			fixtureModels: FIXTURE_MODELS.filter((fixtureModel) => fixtureModel.fixture !== 'rover'),
			outputDirectory: 'artifacts',
			writeArtifact: () => undefined,
		})).rejects.toThrowError('Missing official fixture model \'rover\'.')
	})

	it('preserves exact unfiltered RGBA scanline bytes in encoded PNG data', () => {
		const rgbaPixels = new Uint8ClampedArray([
			1,
			2,
			3,
			4,
			5,
			6,
			7,
			8,
			9,
			10,
			11,
			12,
			13,
			14,
			15,
			16,
		])

		expect(new Uint8Array(inflatedPngImageData(encodeRgbaPng(2, 2, rgbaPixels)))).toEqual(new Uint8Array([
			0,
			1,
			2,
			3,
			4,
			5,
			6,
			7,
			8,
			0,
			9,
			10,
			11,
			12,
			13,
			14,
			15,
			16,
		]))
	})

	it('rejects RGBA buffers that cannot fill the requested PNG dimensions', () => {
		expect(() => encodeRgbaPng(2, 2, new Uint8ClampedArray(4))).toThrowError(
			'RGBA pixel buffer must contain 16 bytes for 2×2.',
		)
	})
})

function fixtureText(fixture: string): string {
	if (fixture === 'chest') {
		return `model chest
size 2 2 2
palette p
color wood #aabbcc
color trim #334455
color dark #111111
material body wood
material accent trim
voxel body 0 0 0
voxel accent 1 0 0
voxel body 0 1 0`
	}

	return `model ${fixture}
size 2 2 2
palette p
color main #aabbcc
color accent #334455
color dark #111111
material body main
material trim accent
voxel body 0 0 0
voxel trim 1 0 0
voxel body 0 1 0`
}

function pngHasTransparentAndOpaquePixels(png: Uint8Array): boolean {
	const width = pngDimensions(png)?.width
	if (width === undefined) {
		return false
	}

	const inflated = inflatedPngImageData(png)
	const alphas = []
	const scanlineLength = width * 4 + 1
	for (let rowOffset = 0; rowOffset < inflated.length; rowOffset += scanlineLength) {
		for (let alphaOffset = rowOffset + 4; alphaOffset < rowOffset + scanlineLength; alphaOffset += 4) {
			alphas.push(inflated[alphaOffset])
		}
	}

	return alphas.includes(0) && alphas.includes(255)
}

function inflatedPngImageData(png: Uint8Array): Uint8Array {
	const idatData = concatenateUint8Arrays(pngChunks(png).filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data))
	return inflateSync(idatData)
}

function pngChunkTypes(png: Uint8Array): Array<string> {
	return pngChunks(png).map((chunk) => chunk.type)
}

function pngDimensions(png: Uint8Array): { width: number, height: number } | undefined {
	const ihdr = pngChunks(png).find((chunk) => chunk.type === 'IHDR')?.data
	if (ihdr === undefined) {
		return undefined
	}

	const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength)
	return { width: view.getUint32(0), height: view.getUint32(4) }
}

function pngChunksHaveValidCrcs(png: Uint8Array): boolean {
	return pngChunks(png).every((chunk) => chunk.crc === crc32(concatenateUint8Arrays([asciiBytes(chunk.type), chunk.data])))
}

function pngChunks(png: Uint8Array): Array<{ type: string, data: Uint8Array, crc: number }> {
	const chunks: Array<{ type: string, data: Uint8Array, crc: number }> = []
	let offset = 8

	while (offset < png.length) {
		const view = new DataView(png.buffer, png.byteOffset + offset)
		const length = view.getUint32(0)
		const type = String.fromCharCode(...png.slice(offset + 4, offset + 8))
		const data = png.slice(offset + 8, offset + 8 + length)
		chunks.push({ type, data, crc: view.getUint32(8 + length) })
		offset += length + 12
	}

	return chunks
}

function asciiBytes(value: string): Uint8Array {
	return Uint8Array.from(value, (character) => character.charCodeAt(0))
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

function crc32(bytes: Uint8Array): number {
	let crc = 0xFFFFFFFF
	for (const byte of bytes) {
		crc ^= byte
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
		}
	}
	return (crc ^ 0xFFFFFFFF) >>> 0
}
