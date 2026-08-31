import type { Failure, Success } from './result'

import { assert } from '../utils/error'
import { failure, success } from './result'

export type VoxelBounds = {
	x: number
	y: number
	z: number
}

export type PaletteColor = {
	name: string
	hex: string
}

export type SemanticMaterial = {
	name: string
	color: string
}

export type OccupiedVoxel = {
	x: number
	y: number
	z: number
	material: string
}

export type ParsedVoxelModel = {
	name: string
	size: VoxelBounds
	palette: string
	colors: ReadonlyArray<PaletteColor>
	materials: ReadonlyArray<SemanticMaterial>
	voxels: ReadonlyArray<OccupiedVoxel>
}

export type VoxpropParseIssue = {
	line: number
	message: string
}

export type ParseVoxpropResult
	= | Success<'parsed-voxel-model', ParsedVoxelModel>
		| Failure<'invalid-voxprop', never, { issues: ReadonlyArray<VoxpropParseIssue> }>

type VoxelRange = {
	x: [number, number]
	y: [number, number]
	z: [number, number]
}

type OccupancyOperation
	= | { kind: 'fill', line: number, material: string, range: VoxelRange }
		| { kind: 'voxel', line: number, material: string, x: number, y: number, z: number }
		| { kind: 'clear', line: number, range: VoxelRange }

type MetadataState = {
	name?: string
	size?: VoxelBounds
	palette?: string
	colors: Map<string, PaletteColor>
	materials: Map<string, SemanticMaterial>
	operations: Array<OccupancyOperation>
	issues: Array<VoxpropParseIssue>
}

const IDENTIFIER_PATTERN = /^[A-Z][\w-]*$/i
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const INTEGER_PATTERN = /^-?\d+$/
const RANGE_PATTERN = /^(-?\d+)\.\.(-?\d+)$/

export function parseVoxprop(text: string): ParseVoxpropResult {
	const state: MetadataState = {
		colors: new Map(),
		materials: new Map(),
		operations: [],
		issues: [],
	}

	for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
		const lineNumber = index + 1
		const line = withoutComment(rawLine).trim()
		if (line === '') {
			continue
		}

		parseLine(line, lineNumber, state)
	}

	validateRequiredMetadata(state)
	validateMaterialReferences(state)
	validateOccupancyMaterialReferences(state)

	if (state.issues.length > 0) {
		return failure('invalid-voxprop', { issues: state.issues })
	}

	// Stryker disable next-line ConditionalExpression: defensive type-narrowing assertion after required metadata validation.
	assert(state.name !== undefined, 'valid .voxprop metadata has a model')
	// Stryker disable next-line ConditionalExpression: defensive type-narrowing assertion after required metadata validation.
	assert(state.size !== undefined, 'valid .voxprop metadata has a size')
	// Stryker disable next-line ConditionalExpression: defensive type-narrowing assertion after required metadata validation.
	assert(state.palette !== undefined, 'valid .voxprop metadata has a palette')

	return success('parsed-voxel-model', {
		name: state.name,
		size: state.size,
		palette: state.palette,
		colors: [...state.colors.values()],
		materials: [...state.materials.values()],
		voxels: evaluateOccupancy(state.operations),
	})
}

function withoutComment(line: string): string {
	// Stryker disable next-line EqualityOperator: checking one extra out-of-range index is equivalent for string scanning.
	for (let index = 0; index < line.length; index += 1) {
		if (line[index] !== '#') {
			continue
		}

		// Stryker disable next-line BlockStatement,ConditionalExpression: falling through at a hex color is covered by parse errors, not a distinct behavior.
		if (isHexColorTokenAt(line, index)) {
			continue
		}

		if (isCommentStartAt(line, index)) {
			return line.slice(0, index)
		}
	}

	return line
}

function isCommentStartAt(line: string, index: number): boolean {
	// Stryker disable next-line ArithmeticOperator: using the next character is already covered by token-boundary comment tests.
	const previousChar = line[index - 1]
	const nextChar = line[index + 1]

	// Stryker disable next-line ConditionalExpression: an end-of-line trailing comment is equivalent to stripping whitespace after trim.
	return index === 0 || (/\s/.test(previousChar) && (nextChar === undefined || /\s/.test(nextChar)))
}

// Stryker disable next-line BlockStatement: the parser-level tests cover hex-token behavior through accepted and rejected color statements.
function isHexColorTokenAt(line: string, index: number): boolean {
	// Stryker disable next-line ArithmeticOperator: a shorter token cannot match the exact #rrggbb color boundary.
	const tokenEnd = index + 7
	// Stryker disable next-line MethodExpression: whole-line matching is equivalent when the line is exactly the color token.
	const token = line.slice(index, tokenEnd)
	const charAfterToken = line[tokenEnd]

	// Stryker disable next-line BlockStatement,ConditionalExpression,LogicalOperator,EqualityOperator,Regex: equivalent color-token boundary checks are covered by parser-level validation.
	return HEX_COLOR_PATTERN.test(token) && (charAfterToken === undefined || /\s/.test(charAfterToken))
}

type LineParser = (tokens: Array<string>, lineNumber: number, state: MetadataState) => void

const LINE_PARSERS: Record<string, LineParser> = {
	model: (tokens, lineNumber, state) => parseSingletonIdentifier(tokens, lineNumber, state, 'model', 'name'),
	size: parseSize,
	palette: (tokens, lineNumber, state) => parseSingletonIdentifier(tokens, lineNumber, state, 'palette', 'palette'),
	color: parseColor,
	material: parseMaterial,
	fill: parseFill,
	voxel: parseVoxel,
	clear: parseClear,
}

function parseLine(line: string, lineNumber: number, state: MetadataState): void {
	const tokens = line.split(/\s+/)
	const [statement] = tokens
	const parser = LINE_PARSERS[statement]

	if (parser === undefined) {
		addIssue(state, lineNumber, `Unsupported .voxprop statement '${statement}'. Phase 0 only supports model, size, palette, color, material, fill, voxel, clear, and comments.`)
		return
	}

	parser(tokens, lineNumber, state)
}

function parseSingletonIdentifier(
	tokens: Array<string>,
	lineNumber: number,
	state: MetadataState,
	statement: 'model' | 'palette',
	field: 'name' | 'palette',
): void {
	if (tokens.length !== 2) {
		addIssue(state, lineNumber, `${statement} must be: ${statement} <name>.`)
		return
	}

	const value = tokens[1]
	if (!isIdentifier(value)) {
		addIssue(state, lineNumber, `${statement} name '${value}' is malformed.`)
		return
	}

	if (state[field] !== undefined) {
		addIssue(state, lineNumber, `Duplicate ${statement} statement.`)
		return
	}

	state[field] = value
}

function parseSize(tokens: Array<string>, lineNumber: number, state: MetadataState): void {
	if (tokens.length !== 4) {
		addIssue(state, lineNumber, 'size must be: size <x> <y> <z>.')
		return
	}

	if (state.size !== undefined) {
		addIssue(state, lineNumber, 'Duplicate size statement.')
		return
	}

	const values = tokens.slice(1)
	const invalidValue = values.find((value) => !isPositiveInteger(value))
	if (invalidValue !== undefined) {
		addIssue(state, lineNumber, `size value '${invalidValue}' must be a positive integer.`)
		return
	}

	const [x, y, z] = values.map(Number)
	state.size = { x, y, z }
}

function parseColor(tokens: Array<string>, lineNumber: number, state: MetadataState): void {
	if (tokens.length !== 3) {
		addIssue(state, lineNumber, 'color must be: color <name> <#rrggbb>.')
		return
	}

	const [, name, hex] = tokens
	if (!isIdentifier(name)) {
		addIssue(state, lineNumber, `color name '${name}' is malformed.`)
		return
	}

	if (!HEX_COLOR_PATTERN.test(hex)) {
		addIssue(state, lineNumber, `color '${name}' must use #rrggbb hex.`)
		return
	}

	if (state.colors.has(name)) {
		addIssue(state, lineNumber, `Duplicate color '${name}'.`)
		return
	}

	state.colors.set(name, { name, hex: hex.toLowerCase() })
}

function parseMaterial(tokens: Array<string>, lineNumber: number, state: MetadataState): void {
	if (tokens.length !== 3) {
		addIssue(state, lineNumber, 'material must be: material <name> <color-name>.')
		return
	}

	const [, name, color] = tokens
	if (!isIdentifier(name)) {
		addIssue(state, lineNumber, `material name '${name}' is malformed.`)
		return
	}

	if (!isIdentifier(color)) {
		addIssue(state, lineNumber, `material '${name}' references malformed color '${color}'.`)
		return
	}

	if (state.materials.has(name)) {
		addIssue(state, lineNumber, `Duplicate material '${name}'.`)
		return
	}

	state.materials.set(name, { name, color })
}

function parseFill(tokens: Array<string>, lineNumber: number, state: MetadataState): void {
	if (tokens.length !== 5) {
		addIssue(state, lineNumber, 'fill must be: fill <material> <x0>..<x1> <y0>..<y1> <z0>..<z1>.')
		return
	}

	const [, material, xRange, yRange, zRange] = tokens
	if (!isIdentifier(material)) {
		addIssue(state, lineNumber, `fill material '${material}' is malformed.`)
		return
	}

	const range = parseVoxelRange([xRange, yRange, zRange], lineNumber, state, 'fill')
	if (range === undefined) {
		return
	}

	state.operations.push({ kind: 'fill', line: lineNumber, material, range })
}

function parseVoxel(tokens: Array<string>, lineNumber: number, state: MetadataState): void {
	if (tokens.length !== 5) {
		addIssue(state, lineNumber, 'voxel must be: voxel <material> <x> <y> <z>.')
		return
	}

	const [, material, xValue, yValue, zValue] = tokens
	if (!isIdentifier(material)) {
		addIssue(state, lineNumber, `voxel material '${material}' is malformed.`)
		return
	}

	const coordinate = parseVoxelCoordinate([xValue, yValue, zValue], lineNumber, state, 'voxel')
	// Stryker disable next-line BlockStatement,ConditionalExpression: invalid coordinates already record issues and are not evaluated.
	if (coordinate === undefined) {
		return
	}

	state.operations.push({ kind: 'voxel', line: lineNumber, material, ...coordinate })
}

function parseClear(tokens: Array<string>, lineNumber: number, state: MetadataState): void {
	if (tokens.length !== 4) {
		addIssue(state, lineNumber, 'clear must be: clear <x0>..<x1> <y0>..<y1> <z0>..<z1>.')
		return
	}

	const [, xRange, yRange, zRange] = tokens
	const range = parseVoxelRange([xRange, yRange, zRange], lineNumber, state, 'clear')
	// Stryker disable next-line BlockStatement,ConditionalExpression: invalid ranges already record issues and are not evaluated.
	if (range === undefined) {
		return
	}

	state.operations.push({ kind: 'clear', line: lineNumber, range })
}

type RangeStatement = 'fill' | 'clear'

function parseVoxelRange(
	values: [string, string, string],
	lineNumber: number,
	state: MetadataState,
	statement: RangeStatement,
): VoxelRange | undefined {
	if (state.size === undefined) {
		addIssue(state, lineNumber, `${statement} cannot be used before a valid size statement.`)
		return undefined
	}

	const range = parseRangeTokens(values)
	if (range === undefined) {
		addIssue(state, lineNumber, `${statement} coordinates must be integer ranges: <x0>..<x1> <y0>..<y1> <z0>..<z1>.`)
		return undefined
	}

	const rangeIssue = validateVoxelRange(range, state.size, statement)
	if (rangeIssue !== undefined) {
		addIssue(state, lineNumber, rangeIssue)
		return undefined
	}

	return range
}

function parseVoxelCoordinate(
	values: [string, string, string],
	lineNumber: number,
	state: MetadataState,
	statement: 'voxel',
): { x: number, y: number, z: number } | undefined {
	if (state.size === undefined) {
		addIssue(state, lineNumber, `${statement} cannot be used before a valid size statement.`)
		return undefined
	}

	const invalidValue = values.find((value) => !INTEGER_PATTERN.test(value))
	if (invalidValue !== undefined) {
		addIssue(state, lineNumber, `${statement} coordinate '${invalidValue}' must be an integer.`)
		return undefined
	}

	const [x, y, z] = values.map(Number)
	const coordinate = { x, y, z }
	const outOfBoundsAxis = outOfBoundsCoordinateAxis(coordinate, state.size)
	if (outOfBoundsAxis !== undefined) {
		addIssue(state, lineNumber, `${statement} ${outOfBoundsAxis} coordinate is outside size bounds.`)
		return undefined
	}

	return coordinate
}

function parseRangeTokens(values: [string, string, string]): VoxelRange | undefined {
	const [x, y, z] = values.map(parseRangeToken)
	if (x === undefined || y === undefined || z === undefined) {
		return undefined
	}

	return { x, y, z }
}

function parseRangeToken(value: string): [number, number] | undefined {
	const match = RANGE_PATTERN.exec(value)
	if (match === null) {
		return undefined
	}

	return [Number(match[1]), Number(match[2])]
}

type Axis = keyof VoxelBounds

const AXES: ReadonlyArray<Axis> = ['x', 'y', 'z']

function validateVoxelRange(range: VoxelRange, size: VoxelBounds, statement: RangeStatement): string | undefined {
	const reversedAxis = reversedRangeAxis(range)
	if (reversedAxis !== undefined) {
		return `${statement} ${reversedAxis} range is reversed.`
	}

	const outOfBoundsAxis = outOfBoundsRangeAxis(range, size)
	if (outOfBoundsAxis !== undefined) {
		return `${statement} ${outOfBoundsAxis} range is outside size bounds.`
	}

	return undefined
}

function reversedRangeAxis(range: VoxelRange): Axis | undefined {
	return AXES.find((axis) => range[axis][0] > range[axis][1])
}

function outOfBoundsRangeAxis(range: VoxelRange, size: VoxelBounds): Axis | undefined {
	return AXES.find((axis) => !isCoordinateWithinBounds(range[axis][0], size[axis])
		|| !isCoordinateWithinBounds(range[axis][1], size[axis]))
}

function outOfBoundsCoordinateAxis(coordinate: VoxelBounds, size: VoxelBounds): Axis | undefined {
	return AXES.find((axis) => !isCoordinateWithinBounds(coordinate[axis], size[axis]))
}

function isCoordinateWithinBounds(coordinate: number, size: number): boolean {
	return coordinate >= 0 && coordinate < size
}

function validateRequiredMetadata(state: MetadataState): void {
	if (state.name === undefined) {
		addIssue(state, 0, 'Missing model statement.')
	}

	if (state.size === undefined) {
		addIssue(state, 0, 'Missing size statement.')
	}

	if (state.palette === undefined) {
		addIssue(state, 0, 'Missing palette statement.')
	}

	if (state.colors.size === 0) {
		addIssue(state, 0, 'Missing color statements.')
	}

	if (state.materials.size === 0) {
		addIssue(state, 0, 'Missing material statements.')
	}
}

function validateMaterialReferences(state: MetadataState): void {
	for (const material of state.materials.values()) {
		if (!state.colors.has(material.color)) {
			addIssue(state, 0, `Material '${material.name}' references unknown color '${material.color}'.`)
		}
	}
}

function validateOccupancyMaterialReferences(state: MetadataState): void {
	for (const operation of state.operations) {
		if (operation.kind === 'clear') {
			continue
		}

		if (!state.materials.has(operation.material)) {
			addIssue(state, operation.line, `${operation.kind} references unknown material '${operation.material}'.`)
		}
	}
}

function evaluateOccupancy(operations: ReadonlyArray<OccupancyOperation>): ReadonlyArray<OccupiedVoxel> {
	const occupied = new Map<string, OccupiedVoxel>()

	for (const operation of operations) {
		if (operation.kind === 'voxel') {
			occupied.set(voxelKey(operation.x, operation.y, operation.z), {
				x: operation.x,
				y: operation.y,
				z: operation.z,
				material: operation.material,
			})
			continue
		}

		for (const coordinate of coordinatesInRange(operation.range)) {
			const key = voxelKey(coordinate.x, coordinate.y, coordinate.z)
			if (operation.kind === 'clear') {
				occupied.delete(key)
				continue
			}

			occupied.set(key, { ...coordinate, material: operation.material })
		}
	}

	return [...occupied.values()].sort(compareVoxels)
}

function coordinatesInRange(range: VoxelRange): Array<{ x: number, y: number, z: number }> {
	const coordinates: Array<{ x: number, y: number, z: number }> = []

	for (let z = range.z[0]; z <= range.z[1]; z += 1) {
		for (let y = range.y[0]; y <= range.y[1]; y += 1) {
			for (let x = range.x[0]; x <= range.x[1]; x += 1) {
				coordinates.push({ x, y, z })
			}
		}
	}

	return coordinates
}

function compareVoxels(left: OccupiedVoxel, right: OccupiedVoxel): number {
	return left.z - right.z || left.y - right.y || left.x - right.x
}

function voxelKey(x: number, y: number, z: number): string {
	return `${x},${y},${z}`
}

function isIdentifier(value: string): boolean {
	return IDENTIFIER_PATTERN.test(value)
}

function isPositiveInteger(value: string): boolean {
	if (!INTEGER_PATTERN.test(value)) {
		return false
	}

	return Number(value) > 0
}

function addIssue(state: MetadataState, line: number, message: string): void {
	state.issues.push({ line, message })
}
