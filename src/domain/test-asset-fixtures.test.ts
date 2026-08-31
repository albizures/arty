import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { failure, success } from './result'
import { validateFixtureSuite } from './test-asset-fixtures'

const CHEST_FIXTURE_PATH = 'test-assets/voxprop-fixtures/chest.voxprop'
const CHAIR_FIXTURE_PATH = 'test-assets/voxprop-fixtures/chair.voxprop'
const LANTERN_FIXTURE_PATH = 'test-assets/voxprop-fixtures/lantern.voxprop'
const GENERATOR_FIXTURE_PATH = 'test-assets/voxprop-fixtures/generator.voxprop'
const ROVER_FIXTURE_PATH = 'test-assets/voxprop-fixtures/rover.voxprop'

const OFFICIAL_FIXTURE_PATHS = [
	CHEST_FIXTURE_PATH,
	CHAIR_FIXTURE_PATH,
	LANTERN_FIXTURE_PATH,
	GENERATOR_FIXTURE_PATH,
	ROVER_FIXTURE_PATH,
] as const

const REQUIRED_CHEST_METADATA = `
# fixture element: wooden body
# fixture element: metal bands
# fixture element: lock plate
# fixture element: raised lid
# fixture element: feet
# fixture asymmetry: offset latch
# fixture stressor-silhouette: iconic silhouette readability
# fixture stressor-material: trim/lock detail survival and material separation
# fixture stressor-view: lid/body readability at 64x64
`

function buildMinimalFixture(metadata: string, options: {
	identity?: string
	modelName?: string
	size?: string
	materials?: ReadonlyArray<string>
} = {}): string {
	const identity = options.identity ?? 'chest'
	const modelName = options.modelName ?? identity
	const size = options.size ?? '4 4 4'
	const materials = options.materials ?? ['one a', 'two b', 'three c']

	return `
# fixture identity: ${identity}
${metadata.trim()}
model ${modelName}
size ${size}
palette test
color a #111111
color b #222222
color c #333333
color d #444444
color e #555555
color f #666666
color g #777777
${materials.map((material) => `material ${material}`).join('\n')}
voxel one 0 0 0
`
}

describe('validateFixtureSuite', () => {
	it('validates the authored chest fixture through the voxprop parser and fixture metadata', () => {
		const result = validateFixtureSuite([{
			path: CHEST_FIXTURE_PATH,
			text: readFileSync(CHEST_FIXTURE_PATH, 'utf8'),
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: CHEST_FIXTURE_PATH, identity: 'chest' }],
		}))
	})

	it('validates the authored chair fixture through the voxprop parser and fixture metadata', () => {
		const result = validateFixtureSuite([{
			path: CHAIR_FIXTURE_PATH,
			text: readFileSync(CHAIR_FIXTURE_PATH, 'utf8'),
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: CHAIR_FIXTURE_PATH, identity: 'chair' }],
		}))
	})

	it('validates the authored lantern fixture through the voxprop parser and fixture metadata', () => {
		const result = validateFixtureSuite([{
			path: LANTERN_FIXTURE_PATH,
			text: readFileSync(LANTERN_FIXTURE_PATH, 'utf8'),
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: LANTERN_FIXTURE_PATH, identity: 'lantern' }],
		}))
	})

	it('validates the authored generator fixture through the voxprop parser and fixture metadata', () => {
		const result = validateFixtureSuite([{
			path: GENERATOR_FIXTURE_PATH,
			text: readFileSync(GENERATOR_FIXTURE_PATH, 'utf8'),
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: GENERATOR_FIXTURE_PATH, identity: 'small-machine' }],
		}))
	})

	it('validates the authored rover fixture through the voxprop parser and fixture metadata', () => {
		const result = validateFixtureSuite([{
			path: ROVER_FIXTURE_PATH,
			text: readFileSync(ROVER_FIXTURE_PATH, 'utf8'),
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: ROVER_FIXTURE_PATH, identity: 'compact-vehicle' }],
		}))
	})

	it('validates the official Phase 0 fixture set', () => {
		const sources = OFFICIAL_FIXTURE_PATHS.map((path) => ({
			path,
			text: readFileSync(path, 'utf8'),
		}))

		const result = validateFixtureSuite(sources)

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [
				{ path: CHEST_FIXTURE_PATH, identity: 'chest' },
				{ path: CHAIR_FIXTURE_PATH, identity: 'chair' },
				{ path: LANTERN_FIXTURE_PATH, identity: 'lantern' },
				{ path: GENERATOR_FIXTURE_PATH, identity: 'small-machine' },
				{ path: ROVER_FIXTURE_PATH, identity: 'compact-vehicle' },
			],
		}))
	})

	it('reports parser failures before metadata validation', () => {
		const result = validateFixtureSuite([{
			path: 'broken.voxprop',
			text: `
# fixture identity: wrong
model oversized
size 25 24 24
palette test
color a #111111
color b #222222
material one a
fill missing 0..0 0..0 0..0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'broken.voxprop', message: 'line 9: fill references unknown material \'missing\'.' },
			],
		}))
	})

	it('reports missing fixture identity metadata before shared validation', () => {
		const result = validateFixtureSuite([{
			path: 'anonymous.voxprop',
			text: `
# fixture note: intentionally ignored unknown metadata
model anonymous
size 1 1 1
palette test
color a #111111
material one a
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'anonymous.voxprop', message: 'fixture identity metadata is required.' },
			],
		}))
	})

	it('reports shared fixture metadata failures after successful parsing', () => {
		const result = validateFixtureSuite([{
			path: 'incomplete.voxprop',
			text: `
# fixture identity: wrong
model oversized
size 25 24 24
palette test
color a #111111
color b #222222
material one a
material two b
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'incomplete.voxprop', message: 'model \'oversized\' must match fixture identity \'wrong\'.' },
				{ path: 'incomplete.voxprop', message: 'fixture size must fit within 24×24×24.' },
				{ path: 'incomplete.voxprop', message: 'fixture must use 3–6 materials.' },
				{ path: 'incomplete.voxprop', message: 'fixture asymmetry metadata is required.' },
				{ path: 'incomplete.voxprop', message: 'fixture must declare a silhouette stressor.' },
				{ path: 'incomplete.voxprop', message: 'fixture must declare a material stressor.' },
				{ path: 'incomplete.voxprop', message: 'fixture must declare a view stressor.' },
			],
		}))
	})

	it('reports missing chest-specific elements and renderer-risk metadata', () => {
		const result = validateFixtureSuite([{
			path: 'thin-chest.voxprop',
			text: `
# fixture identity: chest
# fixture asymmetry: offset handle
# fixture stressor-silhouette: silhouette only
# fixture stressor-material: material only
# fixture stressor-material: repeated material detail
# fixture stressor-view: view only
model chest
size 4 4 4
palette test
color a #111111
color b #222222
color c #333333
material one a
material two b
material three c
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'thin-chest.voxprop', message: 'chest fixture must include wooden body.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must include metal bands.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must include lock plate.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must include raised lid.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must include feet.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must declare iconic silhouette readability as a renderer risk.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must declare trim/lock detail survival as a renderer risk.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must declare material separation as a renderer risk.' },
				{ path: 'thin-chest.voxprop', message: 'chest fixture must declare lid/body readability at 64x64 as a renderer risk.' },
			],
		}))
	})

	it('reports missing chair-specific elements and renderer-risk metadata', () => {
		const result = validateFixtureSuite([{
			path: 'blocky-chair.voxprop',
			text: `
# fixture identity: chair
# fixture asymmetry: offset repair block
# fixture stressor-silhouette: silhouette only
# fixture stressor-material: material only
# fixture stressor-view: view only
model chair
size 4 4 4
palette test
color a #111111
color b #222222
color c #333333
material one a
material two b
material three c
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must include seat slab.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must include four thin legs.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must include back posts.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must include backrest.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must include visible gaps under the seat.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must include visible gaps between supports.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must declare thin-support visibility as a renderer risk.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must declare deterministic occlusion as a renderer risk.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must declare internal-edge handling as a renderer risk.' },
				{ path: 'blocky-chair.voxprop', message: 'chair fixture must declare directional readability as a renderer risk.' },
			],
		}))
	})

	it('reports missing lantern-specific elements and renderer-risk metadata', () => {
		const result = validateFixtureSuite([{
			path: 'blocky-lantern.voxprop',
			text: `
# fixture identity: lantern
# fixture asymmetry: offset switch
# fixture stressor-silhouette: silhouette only
# fixture stressor-material: material only
# fixture stressor-view: view only
model lantern
size 4 4 4
palette test
color a #111111
color b #222222
color c #333333
material one a
material two b
material three c
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must include floor-lamp height proportions.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must include base.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must include vertical stem.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must include glowing core.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must include top cap.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must include asymmetrical side switch.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must declare slender vertical forms as a renderer risk.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must declare bright/accent material handling as a renderer risk.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must declare glow-like material intent without true bloom/transparency as a renderer risk.' },
				{ path: 'blocky-lantern.voxprop', message: 'lantern fixture must declare silhouette stability as a renderer risk.' },
			],
		}))
	})

	it('reports missing compact-vehicle-specific elements and renderer-risk metadata', () => {
		const result = validateFixtureSuite([{
			path: 'plain-vehicle.voxprop',
			text: `
# fixture identity: compact-vehicle
# fixture asymmetry: offset antenna
# fixture stressor-silhouette: silhouette only
# fixture stressor-material: material only
# fixture stressor-view: view only
model compact-vehicle
size 4 4 4
palette test
color a #111111
color b #222222
color c #333333
material one a
material two b
material three c
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must include boxy body.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must include four wheels.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must include cab.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must include front/back distinction.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must include asymmetrical antenna.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must declare rounded-implied wheel forms as a renderer risk.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must declare strong directionality as a renderer risk.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must declare repeated details as a renderer risk.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must declare body/wheel occlusion as a renderer risk.' },
				{ path: 'plain-vehicle.voxprop', message: 'compact-vehicle fixture must declare multi-view consistency as a renderer risk.' },
			],
		}))
	})

	it('reports missing small-machine-specific elements and renderer-risk metadata', () => {
		const result = validateFixtureSuite([{
			path: 'plain-machine.voxprop',
			text: `
# fixture identity: small-machine
# fixture asymmetry: offset pipe
# fixture stressor-silhouette: silhouette only
# fixture stressor-material: material only
# fixture stressor-view: view only
model small-machine
size 4 4 4
palette test
color a #111111
color b #222222
color c #333333
material one a
material two b
material three c
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include hard-surface body.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include vents.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include pipes.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include gauge.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include warning/accent colors.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include feet.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must include asymmetrical side pipe.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must declare noisy small-detail pressure as a renderer risk.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must declare material grouping as a renderer risk.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must declare internal-edge suppression risks as a renderer risk.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must declare isolated-pixel cleanup risks as a renderer risk.' },
				{ path: 'plain-machine.voxprop', message: 'small-machine fixture must declare mechanical legibility at game scale as a renderer risk.' },
			],
		}))
	})

	it('accepts fixtures at the envelope and material-count upper boundaries', () => {
		const result = validateFixtureSuite([{
			path: 'maximal-chest.voxprop',
			text: buildMinimalFixture(REQUIRED_CHEST_METADATA, {
				size: '24 24 24',
				materials: ['one a', 'two b', 'three c', 'four d', 'five e', 'six f'],
			}),
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: 'maximal-chest.voxprop', identity: 'chest' }],
		}))
	})

	it('reports oversized fixture dimensions and too many materials independently', () => {
		const sources = [
			{ path: 'too-wide.voxprop', size: '25 24 24' },
			{ path: 'too-tall.voxprop', size: '24 25 24' },
			{ path: 'too-deep.voxprop', size: '24 24 25' },
		].map(({ path, size }) => ({
			path,
			text: buildMinimalFixture(REQUIRED_CHEST_METADATA, {
				size,
				materials: ['one a', 'two b', 'three c', 'four d', 'five e', 'six f', 'seven g'],
			}),
		}))

		const result = validateFixtureSuite(sources)

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'too-wide.voxprop', message: 'fixture size must fit within 24×24×24.' },
				{ path: 'too-wide.voxprop', message: 'fixture must use 3–6 materials.' },
				{ path: 'too-tall.voxprop', message: 'fixture size must fit within 24×24×24.' },
				{ path: 'too-tall.voxprop', message: 'fixture must use 3–6 materials.' },
				{ path: 'too-deep.voxprop', message: 'fixture size must fit within 24×24×24.' },
				{ path: 'too-deep.voxprop', message: 'fixture must use 3–6 materials.' },
			],
		}))
	})

	it('does not combine adjacent element metadata entries when checking required elements', () => {
		const splitElementMetadata = `
# fixture element: wooden
# fixture element:  body
# fixture element: metal
# fixture element:  bands
# fixture element: lock
# fixture element:  plate
# fixture element: raised
# fixture element:  lid
# fixture element: feet
# fixture asymmetry: offset latch
# fixture stressor-silhouette: iconic silhouette readability
# fixture stressor-material: trim/lock detail survival and material separation
# fixture stressor-view: lid/body readability at 64x64
`

		const result = validateFixtureSuite([{
			path: 'split-elements.voxprop',
			text: buildMinimalFixture(splitElementMetadata),
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'split-elements.voxprop', message: 'chest fixture must include wooden body.' },
				{ path: 'split-elements.voxprop', message: 'chest fixture must include metal bands.' },
				{ path: 'split-elements.voxprop', message: 'chest fixture must include lock plate.' },
				{ path: 'split-elements.voxprop', message: 'chest fixture must include raised lid.' },
			],
		}))
	})

	it('does not combine adjacent stressor metadata entries when checking required renderer risks', () => {
		const splitStressorMetadata = `
# fixture element: wooden body
# fixture element: metal bands
# fixture element: lock plate
# fixture element: raised lid
# fixture element: feet
# fixture asymmetry: offset latch
# fixture stressor-silhouette: iconic silhouette
# fixture stressor-silhouette:  readability
# fixture stressor-material: trim/lock detail
# fixture stressor-material:  survival and material
# fixture stressor-material:  separation
# fixture stressor-view: lid/body readability at
# fixture stressor-view:  64x64
`

		const result = validateFixtureSuite([{
			path: 'split-stressors.voxprop',
			text: buildMinimalFixture(splitStressorMetadata),
		}])

		expect(result).toEqual(failure('invalid-fixture-suite', {
			issues: [
				{ path: 'split-stressors.voxprop', message: 'chest fixture must declare iconic silhouette readability as a renderer risk.' },
				{ path: 'split-stressors.voxprop', message: 'chest fixture must declare trim/lock detail survival as a renderer risk.' },
				{ path: 'split-stressors.voxprop', message: 'chest fixture must declare material separation as a renderer risk.' },
				{ path: 'split-stressors.voxprop', message: 'chest fixture must declare lid/body readability at 64x64 as a renderer risk.' },
			],
		}))
	})

	it('only accepts whole-line fixture metadata comments and trims metadata whitespace', () => {
		const result = validateFixtureSuite([{
			path: 'spaced-metadata.voxprop',
			text: `
   # fixture identity: chest   
# note # fixture identity: wrong
# fixture element: wooden body extra text   
# fixture element: metal bands
# fixture element: lock plate
# fixture element: raised lid
# fixture element: feet
# fixture asymmetry: offset latch   
# fixture stressor-silhouette: iconic silhouette readability   
# fixture stressor-material: trim/lock detail survival and material separation
# fixture stressor-view: lid/body readability at 64x64
model chest
size 4 4 4
palette test
color a #111111
color b #222222
color c #333333
material one a
material two b
material three c
voxel one 0 0 0
`,
		}])

		expect(result).toEqual(success('validated-fixture-suite', {
			fixtures: [{ path: 'spaced-metadata.voxprop', identity: 'chest' }],
		}))
	})
})
