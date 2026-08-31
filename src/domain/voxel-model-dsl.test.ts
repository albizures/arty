import { describe, expect, it } from 'vitest'

import { failure, success } from './result'
import { parseVoxprop } from './voxel-model-dsl'

describe('parseVoxprop', () => {
	it('parses normalized metadata while ignoring full-line and trailing comments', () => {
		const result = parseVoxprop(`
# fixture metadata
model   cart # target model
size	2  3	4
palette default
color wood #AABBcc
color trim #001122
material body wood
material accent trim
`)

		expect(result).toEqual(success('parsed-voxel-model', {
			name: 'cart',
			size: { x: 2, y: 3, z: 4 },
			palette: 'default',
			colors: [
				{ name: 'wood', hex: '#aabbcc' },
				{ name: 'trim', hex: '#001122' },
			],
			materials: [
				{ name: 'body', color: 'wood' },
				{ name: 'accent', color: 'trim' },
			],
			voxels: [],
		}))
	})

	it('preserves hex color tokens while requiring comments to start at a token boundary', () => {
		const result = parseVoxprop(`
model cart#draft
size 1 1 1
palette default
color wood #ABCDEF # normalized uppercase hex before a comment
material body wood
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 2, message: 'model name \'cart#draft\' is malformed.' },
				{ line: 0, message: 'Missing model statement.' },
			],
		}))
	})

	it('evaluates fill, voxel, and clear statements in file order', () => {
		const result = parseVoxprop(`
model cart
size 3 2 2
palette default
color wood #aabbcc
color trim #001122
material body wood
material accent trim
fill body 0..2 0..1 0..0
voxel accent 1 0 0
clear 2..2 0..1 0..0
fill accent 0..0 1..1 0..1
voxel body 0 1 0
`)

		expect(result).toEqual(success('parsed-voxel-model', {
			name: 'cart',
			size: { x: 3, y: 2, z: 2 },
			palette: 'default',
			colors: [
				{ name: 'wood', hex: '#aabbcc' },
				{ name: 'trim', hex: '#001122' },
			],
			materials: [
				{ name: 'body', color: 'wood' },
				{ name: 'accent', color: 'trim' },
			],
			voxels: [
				{ x: 0, y: 0, z: 0, material: 'body' },
				{ x: 1, y: 0, z: 0, material: 'accent' },
				{ x: 0, y: 1, z: 0, material: 'body' },
				{ x: 1, y: 1, z: 0, material: 'body' },
				{ x: 0, y: 1, z: 1, material: 'accent' },
			],
		}))
	})

	it('returns occupied voxels sorted by z, then y, then x independent of statement order', () => {
		const result = parseVoxprop(`
model cart
size 2 2 2
palette default
color wood #aabbcc
material body wood
voxel body 1 1 1
voxel body 1 0 0
voxel body 0 1 0
voxel body 0 0 0
`)

		expect(result).toEqual(success('parsed-voxel-model', {
			name: 'cart',
			size: { x: 2, y: 2, z: 2 },
			palette: 'default',
			colors: [{ name: 'wood', hex: '#aabbcc' }],
			materials: [{ name: 'body', color: 'wood' }],
			voxels: [
				{ x: 0, y: 0, z: 0, material: 'body' },
				{ x: 1, y: 0, z: 0, material: 'body' },
				{ x: 0, y: 1, z: 0, material: 'body' },
				{ x: 1, y: 1, z: 1, material: 'body' },
			],
		}))
	})

	it('rejects occupancy statements that reference unknown materials', () => {
		const result = parseVoxprop(`
model cart
size 1 1 1
palette default
color wood #112233
material body wood
fill trim 0..0 0..0 0..0
voxel accent 0 0 0
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 7, message: 'fill references unknown material \'trim\'.' },
				{ line: 8, message: 'voxel references unknown material \'accent\'.' },
			],
		}))
	})

	it('rejects malformed occupancy coordinates and unknown statements', () => {
		const result = parseVoxprop(`
model cart
size 1 1 1
palette default
color wood #112233
material body wood
fill body 0...0 0..0 0..0
fill 3bad 0..0 0..0 0..0
clear 0..0 0-to-0 0..0
clear 0..0 0..0 z..0
voxel body 0.5 0 0
voxel body 0 0 z
voxel #bad 0 0 0
rotate 90
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 7, message: 'fill coordinates must be integer ranges: <x0>..<x1> <y0>..<y1> <z0>..<z1>.' },
				{ line: 8, message: 'fill material \'3bad\' is malformed.' },
				{ line: 9, message: 'clear coordinates must be integer ranges: <x0>..<x1> <y0>..<y1> <z0>..<z1>.' },
				{ line: 10, message: 'clear coordinates must be integer ranges: <x0>..<x1> <y0>..<y1> <z0>..<z1>.' },
				{ line: 11, message: 'voxel coordinate \'0.5\' must be an integer.' },
				{ line: 12, message: 'voxel coordinate \'z\' must be an integer.' },
				{ line: 13, message: 'voxel material \'#bad\' is malformed.' },
				{ line: 14, message: 'Unsupported .voxprop statement \'rotate\'. Phase 0 only supports model, size, palette, color, material, fill, voxel, clear, and comments.' },
			],
		}))
	})

	it.each([
		['loops', 'for x in 0..1'],
		['macros', 'macro wheel'],
		['includes', 'include ./wheel.voxprop'],
		['transforms', 'rotate y 90'],
		['reusable components', 'component wheel'],
		['expressions', 'fill body 0..size_x 0..0 0..0'],
		['floats', 'voxel body 0.5 0 0'],
		['per-face materials', 'face north body'],
		['meshes', 'mesh cube.obj'],
		['renderer settings', 'renderer pixel-art'],
		['camera settings', 'camera isometric'],
		['export settings', 'export png'],
		['palette generation', 'gradient wood #000000 #ffffff'],
		['external interchange compatibility', 'vox magicavoxel'],
		['user-facing editor semantics', 'gizmo translate'],
	])('rejects out-of-scope %s syntax', (_feature, unsupportedLine) => {
		const result = parseVoxprop(`
model cart
size 1 1 1
palette default
color wood #112233
material body wood
${unsupportedLine}
`)

		expect(result.kind).toBe('invalid-voxprop')
		if (result.kind !== 'invalid-voxprop') {
			return
		}

		expect(result.data.issues).toContainEqual(expect.objectContaining({ line: 7 }))
	})

	it('rejects occupancy coordinates outside declared size bounds', () => {
		const result = parseVoxprop(`
model cart
size 2 2 2
palette default
color wood #112233
material body wood
fill body -1..0 0..0 0..0
fill body 0..0 0..2 0..0
clear 0..0 0..0 2..2
voxel body 2 0 0
voxel body 0 -1 0
voxel body 0 0 2
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 7, message: 'fill x range is outside size bounds.' },
				{ line: 8, message: 'fill y range is outside size bounds.' },
				{ line: 9, message: 'clear z range is outside size bounds.' },
				{ line: 10, message: 'voxel x coordinate is outside size bounds.' },
				{ line: 11, message: 'voxel y coordinate is outside size bounds.' },
				{ line: 12, message: 'voxel z coordinate is outside size bounds.' },
			],
		}))
	})

	it('rejects reversed ranges and occupancy before valid size metadata', () => {
		const result = parseVoxprop(`
model cart
palette default
color wood #112233
material body wood
fill body 0..0 0..0 0..0
clear 1..0 0..0 0..0
size two 2 2
voxel body 0 0 0
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 6, message: 'fill cannot be used before a valid size statement.' },
				{ line: 7, message: 'clear cannot be used before a valid size statement.' },
				{ line: 8, message: 'size value \'two\' must be a positive integer.' },
				{ line: 9, message: 'voxel cannot be used before a valid size statement.' },
				{ line: 0, message: 'Missing size statement.' },
			],
		}))
	})

	it('rejects reversed ranges after size metadata', () => {
		const result = parseVoxprop(`
model cart
size 2 2 2
palette default
color wood #112233
material body wood
fill body 1..0 0..0 0..0
clear 0..0 1..0 0..0
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 7, message: 'fill x range is reversed.' },
				{ line: 8, message: 'clear y range is reversed.' },
			],
		}))
	})

	it('rejects missing required metadata statements', () => {
		const result = parseVoxprop('')

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 0, message: 'Missing model statement.' },
				{ line: 0, message: 'Missing size statement.' },
				{ line: 0, message: 'Missing palette statement.' },
				{ line: 0, message: 'Missing color statements.' },
				{ line: 0, message: 'Missing material statements.' },
			],
		}))
	})

	it('rejects duplicate singleton and named metadata statements', () => {
		const result = parseVoxprop(`
model cart
model wagon
size 1 1 1
size 2 2 2
palette default
palette alt
color wood #112233
color wood #445566
material body wood
material body wood
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 3, message: 'Duplicate model statement.' },
				{ line: 5, message: 'Duplicate size statement.' },
				{ line: 7, message: 'Duplicate palette statement.' },
				{ line: 9, message: 'Duplicate color \'wood\'.' },
				{ line: 11, message: 'Duplicate material \'body\'.' },
			],
		}))
	})

	it('rejects malformed metadata shapes and values with line-specific errors', () => {
		const result = parseVoxprop(`
model
size 1 two 3
size 1e2 1 1
size 0 1 1
palette 1bad
color 2bad #123456
color wood 123456
material 3bad wood
material body #bad
fill body 0..1 0..1 0..1
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 2, message: 'model must be: model <name>.' },
				{ line: 3, message: 'size value \'two\' must be a positive integer.' },
				{ line: 4, message: 'size value \'1e2\' must be a positive integer.' },
				{ line: 5, message: 'size value \'0\' must be a positive integer.' },
				{ line: 6, message: 'palette name \'1bad\' is malformed.' },
				{ line: 7, message: 'color name \'2bad\' is malformed.' },
				{ line: 8, message: 'color \'wood\' must use #rrggbb hex.' },
				{ line: 9, message: 'material name \'3bad\' is malformed.' },
				{ line: 10, message: 'material \'body\' references malformed color \'#bad\'.' },
				{ line: 11, message: 'fill cannot be used before a valid size statement.' },
				{ line: 0, message: 'Missing model statement.' },
				{ line: 0, message: 'Missing size statement.' },
				{ line: 0, message: 'Missing palette statement.' },
				{ line: 0, message: 'Missing color statements.' },
				{ line: 0, message: 'Missing material statements.' },
			],
		}))
	})

	it('rejects hex-looking color values that have trailing characters', () => {
		const result = parseVoxprop(`
model cart
size 1 1 1
palette default
color wood #112233x
material body wood
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 5, message: 'color \'wood\' must use #rrggbb hex.' },
				{ line: 0, message: 'Missing color statements.' },
				{ line: 0, message: 'Material \'body\' references unknown color \'wood\'.' },
			],
		}))
	})

	it('rejects unresolved material color references', () => {
		const result = parseVoxprop(`
model cart
size 1 1 1
palette default
color wood #112233
material body metal
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 0, message: 'Material \'body\' references unknown color \'metal\'.' },
			],
		}))
	})

	it('rejects statement arity errors', () => {
		const result = parseVoxprop(`
model cart extra
size 1 1
palette
color wood
material body
fill body 0..0 0..0
voxel body 0 0
clear 0..0 0..0
`)

		expect(result).toEqual(failure('invalid-voxprop', {
			issues: [
				{ line: 2, message: 'model must be: model <name>.' },
				{ line: 3, message: 'size must be: size <x> <y> <z>.' },
				{ line: 4, message: 'palette must be: palette <name>.' },
				{ line: 5, message: 'color must be: color <name> <#rrggbb>.' },
				{ line: 6, message: 'material must be: material <name> <color-name>.' },
				{ line: 7, message: 'fill must be: fill <material> <x0>..<x1> <y0>..<y1> <z0>..<z1>.' },
				{ line: 8, message: 'voxel must be: voxel <material> <x> <y> <z>.' },
				{ line: 9, message: 'clear must be: clear <x0>..<x1> <y0>..<y1> <z0>..<z1>.' },
				{ line: 0, message: 'Missing model statement.' },
				{ line: 0, message: 'Missing size statement.' },
				{ line: 0, message: 'Missing palette statement.' },
				{ line: 0, message: 'Missing color statements.' },
				{ line: 0, message: 'Missing material statements.' },
			],
		}))
	})
})
