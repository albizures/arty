import type { OfficialArtifactMatrixEntry, OfficialFixtureKey } from './artifact-matrix'
import type { ParsedVoxelModel } from './voxel-model-dsl'

import { deflateSync } from 'node:zlib'

import { OFFICIAL_ARTIFACT_MATRIX } from './artifact-matrix'
import { renderVoxelSprite } from './voxel-sprite-renderer'

export type OfficialFixtureModel = {
	fixture: OfficialFixtureKey
	model: ParsedVoxelModel
}

export type OfficialPngArtifactWriter = (artifact: GeneratedOfficialPngArtifact) => void | Promise<void>

export type GenerateOfficialPngArtifactsRequest = {
	fixtureModels: ReadonlyArray<OfficialFixtureModel>
	outputDirectory: string
	writeArtifact: OfficialPngArtifactWriter
}

export type GeneratedOfficialPngArtifact = OfficialArtifactMatrixEntry & {
	path: string
	png: Uint8Array
	transparentBackground: true
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const COLOR_TYPE_RGBA = 6
const BIT_DEPTH_8 = 8
const PNG_COMPRESSION_METHOD_DEFLATE = 0
const PNG_FILTER_METHOD_ADAPTIVE = 0
const PNG_INTERLACE_NONE = 0
const BYTES_PER_RGBA_PIXEL = 4
const FILTER_TYPE_NONE = 0
const CRC_TABLE = makeCrcTable()

export async function generateOfficialPngArtifacts(
	request: GenerateOfficialPngArtifactsRequest,
): Promise<ReadonlyArray<GeneratedOfficialPngArtifact>> {
	const modelsByFixture = new Map(request.fixtureModels.map((fixtureModel) => [fixtureModel.fixture, fixtureModel.model]))
	const artifacts = OFFICIAL_ARTIFACT_MATRIX.map((matrixEntry) => {
		const model = modelsByFixture.get(matrixEntry.fixture)
		if (model === undefined) {
			throw new Error(`Missing official fixture model '${matrixEntry.fixture}'.`)
		}

		const render = renderVoxelSprite({
			model,
			variant: matrixEntry.renderer,
			direction: matrixEntry.direction,
			elevation: matrixEntry.elevation,
			outputSize: matrixEntry.outputSize,
		})

		return {
			...matrixEntry,
			path: joinArtifactPath(request.outputDirectory, matrixEntry.artifactName),
			png: encodeRgbaPng(render.outputSize, render.outputSize, render.pixels),
			transparentBackground: true,
		} satisfies GeneratedOfficialPngArtifact
	})

	for (const artifact of artifacts) {
		await request.writeArtifact(artifact)
	}

	return artifacts
}

export function encodeRgbaPng(width: number, height: number, rgbaPixels: Uint8ClampedArray): Uint8Array {
	const expectedPixelBytes = width * height * BYTES_PER_RGBA_PIXEL
	if (rgbaPixels.length !== expectedPixelBytes) {
		throw new Error(`RGBA pixel buffer must contain ${expectedPixelBytes} bytes for ${width}×${height}.`)
	}

	return concatenateUint8Arrays([
		PNG_SIGNATURE,
		pngChunk('IHDR', ihdrData(width, height)),
		pngChunk('IDAT', deflateSync(scanlines(width, height, rgbaPixels))),
		pngChunk('IEND', new Uint8Array()),
	])
}

function joinArtifactPath(outputDirectory: string, artifactName: string): string {
	return `${outputDirectory.replace(/\/$/, '')}/${artifactName}`
}

function ihdrData(width: number, height: number): Uint8Array {
	const data = new Uint8Array(13)
	const view = new DataView(data.buffer)
	view.setUint32(0, width)
	view.setUint32(4, height)
	data[8] = BIT_DEPTH_8
	data[9] = COLOR_TYPE_RGBA
	data[10] = PNG_COMPRESSION_METHOD_DEFLATE
	data[11] = PNG_FILTER_METHOD_ADAPTIVE
	data[12] = PNG_INTERLACE_NONE
	return data
}

function scanlines(width: number, height: number, rgbaPixels: Uint8ClampedArray): Uint8Array {
	const rowBytes = width * BYTES_PER_RGBA_PIXEL
	const data = new Uint8Array((rowBytes + 1) * height)

	for (let row = 0; row < height; row += 1) {
		const sourceOffset = row * rowBytes
		const targetOffset = row * (rowBytes + 1)
		data[targetOffset] = FILTER_TYPE_NONE
		data.set(rgbaPixels.subarray(sourceOffset, sourceOffset + rowBytes), targetOffset + 1)
	}

	return data
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const chunk = new Uint8Array(12 + data.length)
	const view = new DataView(chunk.buffer)
	const typeBytes = asciiBytes(type)
	view.setUint32(0, data.length)
	chunk.set(typeBytes, 4)
	chunk.set(data, 8)
	view.setUint32(8 + data.length, crc32(concatenateUint8Arrays([typeBytes, data])))
	return chunk
}

function asciiBytes(value: string): Uint8Array {
	return Uint8Array.from(value, (character) => character.charCodeAt(0))
}

function concatenateUint8Arrays(arrays: ReadonlyArray<Uint8Array>): Uint8Array {
	const totalLength = arrays.reduce((sum, array) => sum + array.length, 0)
	const combined = new Uint8Array(totalLength)
	let offset = 0

	for (const array of arrays) {
		combined.set(array, offset)
		offset += array.length
	}

	return combined
}

function crc32(bytes: Uint8Array): number {
	let crc = 0xFFFFFFFF
	for (const byte of bytes) {
		crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
	}
	return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeCrcTable(): Uint32Array {
	const table = new Uint32Array(256)
	for (let index = 0; index < table.length; index += 1) {
		let crc = index
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc & 1) === 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1
		}
		table[index] = crc >>> 0
	}
	return table
}
