import type { GeneratedOfficialPngArtifact } from './official-artifact-generator'

import type { OfficialRendererVariantKey } from './renderer-variant'

import { deflateSync, inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { generateInternalContactSheets, generateSpriteSheets } from './artifact-assembly'
import { officialArtifactName } from './artifact-matrix'
import { OFFICIAL_CAMERA_DIRECTION_PRESETS } from './camera-output-preset'

import { encodeRgbaPng } from './official-artifact-generator'
import { OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS } from './renderer-variant'

describe('generateSpriteSheets', () => {
	it('assembles each fixture/renderer/elevation/size direction set into one transparent row', async () => {
		const writtenPaths: Array<string> = []
		const artifacts = OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction, index) => officialArtifact({
			renderer: 'full',
			direction: direction.key,
			color: [index + 1, 20, 30, 255],
			markers: [{ x: 63, y: 1, color: [index + 1, 21, 31, 255] }],
		}))

		const spriteSheets = await generateSpriteSheets({
			artifacts,
			outputDirectory: 'reports/sheets/',
			writeArtifact: (artifact) => {
				writtenPaths.push(artifact.path)
			},
		})

		expect(spriteSheets).toHaveLength(1)
		expect(writtenPaths).toEqual(['reports/sheets/chest__full__elev26__64__sprite-sheet.png'])
		expect(spriteSheets[0]).toMatchObject({
			fixture: 'chest',
			renderer: 'full',
			elevation: 'elev26',
			outputSize: 64,
			artifactName: 'chest__full__elev26__64__sprite-sheet.png',
			transparentBackground: true,
			directions: ['front-right', 'back-right', 'back-left', 'front-left'],
			sourceArtifactNames: artifacts.map((artifact) => artifact.artifactName),
		})
		expect(pngDimensions(spriteSheets[0]?.png ?? new Uint8Array())).toEqual({ width: 256, height: 64 })
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 0, 0)).toEqual([1, 20, 30, 255])
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 64, 0)).toEqual([2, 20, 30, 255])
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 128, 0)).toEqual([3, 20, 30, 255])
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 192, 0)).toEqual([4, 20, 30, 255])
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 1, 0)).toEqual([0, 0, 0, 0])
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 63, 1)).toEqual([1, 21, 31, 255])
		expect(pixelAt(spriteSheets[0]?.png ?? new Uint8Array(), 127, 1)).toEqual([2, 21, 31, 255])
	})

	it('keeps sprite sheet groups separated by every grouping axis', async () => {
		const collidingWithoutSeparator = [
			{ fixture: 'a', renderer: 'bc', elevation: 'd' },
			{ fixture: 'ab', renderer: 'c', elevation: 'd' },
		] as const
		const artifacts = collidingWithoutSeparator.flatMap((group, groupIndex) => {
			return OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => officialArtifact({
				...group,
				direction: direction.key,
				color: [groupIndex + 1, 0, 0, 255],
			}))
		})

		const spriteSheets = await generateSpriteSheets({ artifacts, outputDirectory: 'reports' })

		expect(spriteSheets).toHaveLength(2)
		expect(spriteSheets.map((sheet) => sheet.artifactName)).toEqual([
			'a__bc__d__64__sprite-sheet.png',
			'ab__c__d__64__sprite-sheet.png',
		])
	})

	it('rejects incomplete direction sets instead of silently producing partial sprite sheets', async () => {
		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.slice(1).map((direction, index) => officialArtifact({
				renderer: 'baseline',
				direction: direction.key,
				color: [index + 1, 0, 0, 255],
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Missing direction \'front-right\' for sprite sheet chest/baseline/elev26/64.')
	})

	it('rejects sources that are not PNG files', async () => {
		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: new Uint8Array([1, 2, 3]),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Only PNG sources can be assembled.')

		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: new Uint8Array([137, 1, 2, 3, 4, 5, 6, 7]),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Only PNG sources can be assembled.')
	})

	it('rejects PNG sources without IHDR metadata', async () => {
		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: pngWithoutIhdr(),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('PNG source is missing IHDR.')
	})

	it('rejects non-RGBA PNG sources', async () => {
		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: onePixelPng({ bitDepth: 8, colorType: 2, filterType: 0 }),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Only 8-bit RGBA PNG sources can be assembled.')

		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: onePixelPng({ bitDepth: 16, colorType: 6, filterType: 0 }),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Only 8-bit RGBA PNG sources can be assembled.')
	})

	it('rejects filtered PNG sources and unexpected source dimensions', async () => {
		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: onePixelPng({ bitDepth: 8, colorType: 6, filterType: 0, width: 1, height: 64 }),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Expected 64×64 PNG source.')

		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => ({
				...officialArtifact({ renderer: 'baseline', direction: direction.key, color: [1, 0, 0, 255] }),
				png: onePixelPng({ bitDepth: 8, colorType: 6, filterType: 0, width: 64, height: 1 }),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Expected 64×64 PNG source.')

		await expect(generateSpriteSheets({
			artifacts: OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => officialArtifact({
				renderer: 'baseline',
				direction: direction.key,
				color: [1, 0, 0, 255],
				png: onePixelPng({ bitDepth: 8, colorType: 6, filterType: 1, width: 64, height: 64 }),
			})),
			outputDirectory: 'reports',
		})).rejects.toThrowError('Only unfiltered PNG scanlines can be assembled.')
	})
})

describe('generateInternalContactSheets', () => {
	it('builds labeled internal debug contact sheets that are not blind participant stimuli', async () => {
		const artifacts = OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.flatMap((renderer, row) => {
			return OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction, column) => officialArtifact({
				renderer,
				direction: direction.key,
				color: [row + 1, column + 1, 40, 255],
			}))
		})

		const writtenPaths: Array<string> = []
		const contactSheets = await generateInternalContactSheets({
			artifacts,
			outputDirectory: 'reports/contact',
			writeArtifact: (artifact) => {
				writtenPaths.push(artifact.path)
			},
		})

		expect(writtenPaths).toEqual(['reports/contact/chest__internal-contact__elev26__64.png'])

		expect(contactSheets).toHaveLength(1)
		expect(contactSheets[0]).toMatchObject({
			fixture: 'chest',
			elevation: 'elev26',
			outputSize: 64,
			artifactName: 'chest__internal-contact__elev26__64.png',
			path: 'reports/contact/chest__internal-contact__elev26__64.png',
			stimulusRole: 'internal-debug-not-blind-stimulus',
			labelsRevealRendererIdentity: true,
		})
		expect(contactSheets[0]?.cells.map((cell) => cell.label)).toEqual([
			'baseline / front-right',
			'baseline / back-right',
			'baseline / back-left',
			'baseline / front-left',
			'conservative / front-right',
			'conservative / back-right',
			'conservative / back-left',
			'conservative / front-left',
			'full / front-right',
			'full / back-right',
			'full / back-left',
			'full / front-left',
		])
		expect(pngDimensions(contactSheets[0]?.png ?? new Uint8Array())).toEqual({ width: 256, height: 192 })
		expect(pixelAt(contactSheets[0]?.png ?? new Uint8Array(), 0, 0)).toEqual([1, 1, 40, 255])
		expect(pixelAt(contactSheets[0]?.png ?? new Uint8Array(), 64, 64)).toEqual([2, 2, 40, 255])
		expect(pixelAt(contactSheets[0]?.png ?? new Uint8Array(), 192, 128)).toEqual([3, 4, 40, 255])
	})

	it('keeps contact sheet groups separated by every grouping axis', async () => {
		const collidingWithoutSeparator = [
			{ fixture: 'a', elevation: 'bc' },
			{ fixture: 'ab', elevation: 'c' },
		] as const
		const artifacts = collidingWithoutSeparator.flatMap((group, groupIndex) => {
			return OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.flatMap((renderer) => {
				return OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => officialArtifact({
					...group,
					renderer,
					direction: direction.key,
					color: [groupIndex + 1, 0, 0, 255],
				}))
			})
		})

		const contactSheets = await generateInternalContactSheets({ artifacts, outputDirectory: 'reports/contact' })

		expect(contactSheets).toHaveLength(2)
		expect(contactSheets.map((sheet) => sheet.artifactName)).toEqual([
			'a__internal-contact__bc__64.png',
			'ab__internal-contact__c__64.png',
		])
	})

	it('rejects missing renderer/direction cells instead of silently producing partial contact sheets', async () => {
		await expect(generateInternalContactSheets({
			artifacts: OFFICIAL_ARTIFACT_RENDERER_VARIANT_KEYS.flatMap((renderer) => {
				return OFFICIAL_CAMERA_DIRECTION_PRESETS.map((direction) => officialArtifact({
					renderer,
					direction: direction.key,
					color: [1, 2, 3, 255],
				}))
			}).filter((artifact) => artifact.renderer !== 'baseline' || artifact.direction !== 'front-right'),
			outputDirectory: 'reports/contact',
		})).rejects.toThrowError('Missing baseline/front-right for contact sheet chest/elev26/64.')
	})
})

function officialArtifact(options: {
	fixture?: string
	renderer: string
	elevation?: string
	direction: GeneratedOfficialPngArtifact['direction']
	color: [number, number, number, number]
	markers?: ReadonlyArray<{ x: number, y: number, color: [number, number, number, number] }>
	png?: Uint8Array
}): GeneratedOfficialPngArtifact {
	const outputSize = 64
	const pixels = new Uint8ClampedArray(outputSize * outputSize * 4)
	pixels.set(options.color, 0)
	for (const marker of options.markers ?? []) {
		pixels.set(marker.color, (marker.y * outputSize + marker.x) * 4)
	}
	const fixture = (options.fixture ?? 'chest') as GeneratedOfficialPngArtifact['fixture']
	const renderer = options.renderer as OfficialRendererVariantKey
	const elevation = (options.elevation ?? 'elev26') as GeneratedOfficialPngArtifact['elevation']
	const artifactName = officialArtifactName({
		fixture,
		renderer,
		elevation,
		outputSize,
		direction: options.direction,
	})

	return {
		fixture,
		renderer,
		elevation,
		outputSize,
		direction: options.direction,
		artifactName,
		path: `artifacts/${artifactName}`,
		png: options.png ?? encodeRgbaPng(outputSize, outputSize, pixels),
		transparentBackground: true,
	}
}

function pngWithoutIhdr(): Uint8Array {
	return concatenateUint8Arrays([
		new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
		pngChunk('IEND', new Uint8Array()),
	])
}

function onePixelPng(options: { bitDepth: number, colorType: number, filterType: number, width?: number, height?: number }): Uint8Array {
	const width = options.width ?? 1
	const height = options.height ?? 1
	const ihdr = new Uint8Array(13)
	const view = new DataView(ihdr.buffer)
	view.setUint32(0, width)
	view.setUint32(4, height)
	ihdr[8] = options.bitDepth
	ihdr[9] = options.colorType
	const scanline = new Uint8Array((width * 4 + 1) * height)
	for (let row = 0; row < height; row += 1) {
		scanline[row * (width * 4 + 1)] = options.filterType
	}

	const compressedScanline = deflateSync(scanline)
	const splitIndex = Math.ceil(compressedScanline.length / 2)

	return concatenateUint8Arrays([
		new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', compressedScanline.subarray(0, splitIndex)),
		pngChunk('IDAT', compressedScanline.subarray(splitIndex)),
		pngChunk('IEND', new Uint8Array()),
	])
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const chunk = new Uint8Array(12 + data.length)
	const view = new DataView(chunk.buffer)
	view.setUint32(0, data.length)
	chunk.set(Uint8Array.from(type, (character) => character.charCodeAt(0)), 4)
	chunk.set(data, 8)
	return chunk
}

function pngDimensions(png: Uint8Array): { width: number, height: number } | undefined {
	const ihdr = pngChunks(png).find((chunk) => chunk.type === 'IHDR')?.data
	if (ihdr === undefined) {
		return undefined
	}

	const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength)
	return { width: view.getUint32(0), height: view.getUint32(4) }
}

function pixelAt(png: Uint8Array, x: number, y: number): [number, number, number, number] {
	const dimensions = pngDimensions(png)
	if (dimensions === undefined) {
		throw new Error('Missing PNG dimensions.')
	}

	const inflated = inflateSync(concatenateUint8Arrays(pngChunks(png).filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)))
	const offset = y * (dimensions.width * 4 + 1) + 1 + x * 4
	return [inflated[offset] ?? 0, inflated[offset + 1] ?? 0, inflated[offset + 2] ?? 0, inflated[offset + 3] ?? 0]
}

function pngChunks(png: Uint8Array): Array<{ type: string, data: Uint8Array }> {
	const chunks: Array<{ type: string, data: Uint8Array }> = []
	let offset = 8

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
