import type { Failure, Success } from './result'
import type { ParsedVoxelModel, VoxelBounds } from './voxel-model-dsl'

import { failure, success } from './result'
import { parseVoxprop } from './voxel-model-dsl'

export type FixtureSource = {
	path: string
	text: string
}

export type FixtureValidationIssue = {
	path: string
	message: string
}

export type ValidatedFixture = {
	path: string
	identity: string
}

export type ValidateFixtureSuiteResult
	= | Success<'validated-fixture-suite', { fixtures: ReadonlyArray<ValidatedFixture> }>
		| Failure<'invalid-fixture-suite', never, { issues: ReadonlyArray<FixtureValidationIssue> }>

type FixtureMetadata = {
	identity?: string
	elements: ReadonlyArray<string>
	asymmetry?: string
	stressors: ReadonlyMap<string, ReadonlyArray<string>>
}

const MAX_ENVELOPE = 24
const MIN_MATERIALS = 3
const MAX_MATERIALS = 6

const REQUIRED_STRESSOR_CATEGORIES = ['silhouette', 'material', 'view'] as const

const REQUIRED_CHEST_ELEMENTS = [
	'wooden body',
	'metal bands',
	'lock plate',
	'raised lid',
	'feet',
] as const

const REQUIRED_CHEST_RISK_PHRASES = [
	'iconic silhouette readability',
	'trim/lock detail survival',
	'material separation',
	'lid/body readability at 64x64',
] as const

const REQUIRED_CHAIR_ELEMENTS = [
	'seat slab',
	'four thin legs',
	'back posts',
	'backrest',
	'visible gaps under the seat',
	'visible gaps between supports',
] as const

const REQUIRED_CHAIR_RISK_PHRASES = [
	'thin-support visibility',
	'deterministic occlusion',
	'internal-edge handling',
	'directional readability',
] as const

const REQUIRED_LANTERN_ELEMENTS = [
	'floor-lamp height proportions',
	'base',
	'vertical stem',
	'glowing core',
	'top cap',
	'asymmetrical side switch',
] as const

const REQUIRED_LANTERN_RISK_PHRASES = [
	'slender vertical forms',
	'bright/accent material handling',
	'glow-like material intent without true bloom/transparency',
	'silhouette stability',
] as const

const REQUIRED_SMALL_MACHINE_ELEMENTS = [
	'hard-surface body',
	'vents',
	'pipes',
	'gauge',
	'warning/accent colors',
	'feet',
	'asymmetrical side pipe',
] as const

const REQUIRED_SMALL_MACHINE_RISK_PHRASES = [
	'noisy small-detail pressure',
	'material grouping',
	'internal-edge suppression risks',
	'isolated-pixel cleanup risks',
	'mechanical legibility at game scale',
] as const

const REQUIRED_VEHICLE_ELEMENTS = [
	'boxy body',
	'four wheels',
	'cab',
	'front/back distinction',
	'asymmetrical antenna',
] as const

const REQUIRED_VEHICLE_RISK_PHRASES = [
	'rounded-implied wheel forms',
	'strong directionality',
	'repeated details',
	'body/wheel occlusion',
	'multi-view consistency',
] as const

export function validateFixtureSuite(sources: ReadonlyArray<FixtureSource>): ValidateFixtureSuiteResult {
	const outcomes = sources.map(validateFixtureSource)
	const issues = outcomes.flatMap((outcome) => outcome.issues)
	// Stryker disable next-line ConditionalExpression,ArrayDeclaration: fixtures from invalid sources are intentionally omitted, and invalid-suite results expose only issues.
	const fixtures = outcomes.flatMap((outcome) => outcome.fixture === undefined ? [] : [outcome.fixture])

	if (issues.length > 0) {
		return failure('invalid-fixture-suite', { issues })
	}

	return success('validated-fixture-suite', { fixtures })
}

type FixtureSourceValidation = {
	fixture?: ValidatedFixture
	issues: Array<FixtureValidationIssue>
}

function validateFixtureSource(source: FixtureSource): FixtureSourceValidation {
	const parseResult = parseVoxprop(source.text)
	if (parseResult.kind === 'invalid-voxprop') {
		return { issues: parseResult.data.issues.map((parseIssue) => ({
			path: source.path,
			message: `line ${parseIssue.line}: ${parseIssue.message}`,
		})) }
	}

	const metadata = parseFixtureMetadata(source.text)
	const identity = metadata.identity
	if (identity === undefined) {
		return { issues: [{ path: source.path, message: 'fixture identity metadata is required.' }] }
	}

	const issues = [
		...validateSharedFixture(source.path, identity, metadata, parseResult.data),
		...validateSpecializedFixture(source.path, identity, metadata),
	]

	return {
		fixture: { path: source.path, identity },
		issues,
	}
}

function validateSharedFixture(
	path: string,
	identity: string,
	metadata: FixtureMetadata,
	model: ParsedVoxelModel,
): Array<FixtureValidationIssue> {
	return [
		...validateIdentity(path, identity, model.name),
		...validateEnvelope(path, model.size),
		...validateMaterialCount(path, model.materials.length),
		...validateAsymmetry(path, metadata),
		...validateStressorCategories(path, metadata),
	]
}

function validateSpecializedFixture(path: string, identity: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	if (identity === 'chest') {
		return validateChestFixture(path, metadata)
	}

	if (identity === 'chair') {
		return validateChairFixture(path, metadata)
	}

	if (identity === 'lantern') {
		return validateLanternFixture(path, metadata)
	}

	if (identity === 'small-machine') {
		return validateSmallMachineFixture(path, metadata)
	}

	if (identity === 'compact-vehicle') {
		return validateVehicleFixture(path, metadata)
	}

	return []
}

function validateIdentity(path: string, identity: string, modelName: string): Array<FixtureValidationIssue> {
	if (modelName === identity) {
		return []
	}

	return [{ path, message: `model '${modelName}' must match fixture identity '${identity}'.` }]
}

function validateEnvelope(path: string, size: VoxelBounds): Array<FixtureValidationIssue> {
	if (size.x <= MAX_ENVELOPE && size.y <= MAX_ENVELOPE && size.z <= MAX_ENVELOPE) {
		return []
	}

	return [{ path, message: `fixture size must fit within ${MAX_ENVELOPE}×${MAX_ENVELOPE}×${MAX_ENVELOPE}.` }]
}

function validateMaterialCount(path: string, materialCount: number): Array<FixtureValidationIssue> {
	if (materialCount >= MIN_MATERIALS && materialCount <= MAX_MATERIALS) {
		return []
	}

	return [{ path, message: `fixture must use ${MIN_MATERIALS}–${MAX_MATERIALS} materials.` }]
}

function validateAsymmetry(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	if (metadata.asymmetry !== undefined) {
		return []
	}

	return [{ path, message: 'fixture asymmetry metadata is required.' }]
}

function validateStressorCategories(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return REQUIRED_STRESSOR_CATEGORIES
		.filter((category) => !metadata.stressors.has(category))
		.map((category) => ({ path, message: `fixture must declare a ${category} stressor.` }))
}

function validateChestFixture(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return [
		...validateChestElements(path, metadata),
		...validateChestStressors(path, metadata),
	]
}

function validateChestElements(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredElements(path, 'chest', metadata, REQUIRED_CHEST_ELEMENTS)
}

function validateChestStressors(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredStressors(path, 'chest', metadata, REQUIRED_CHEST_RISK_PHRASES)
}

function validateChairFixture(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return [
		...validateChairElements(path, metadata),
		...validateChairStressors(path, metadata),
	]
}

function validateChairElements(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredElements(path, 'chair', metadata, REQUIRED_CHAIR_ELEMENTS)
}

function validateChairStressors(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredStressors(path, 'chair', metadata, REQUIRED_CHAIR_RISK_PHRASES)
}

function validateLanternFixture(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return [
		...validateLanternElements(path, metadata),
		...validateLanternStressors(path, metadata),
	]
}

function validateLanternElements(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredElements(path, 'lantern', metadata, REQUIRED_LANTERN_ELEMENTS)
}

function validateLanternStressors(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredStressors(path, 'lantern', metadata, REQUIRED_LANTERN_RISK_PHRASES)
}

function validateSmallMachineFixture(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return [
		...validateSmallMachineElements(path, metadata),
		...validateSmallMachineStressors(path, metadata),
	]
}

function validateSmallMachineElements(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredElements(path, 'small-machine', metadata, REQUIRED_SMALL_MACHINE_ELEMENTS)
}

function validateSmallMachineStressors(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredStressors(path, 'small-machine', metadata, REQUIRED_SMALL_MACHINE_RISK_PHRASES)
}

function validateVehicleFixture(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return [
		...validateVehicleElements(path, metadata),
		...validateVehicleStressors(path, metadata),
	]
}

function validateVehicleElements(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredElements(path, 'compact-vehicle', metadata, REQUIRED_VEHICLE_ELEMENTS)
}

function validateVehicleStressors(path: string, metadata: FixtureMetadata): Array<FixtureValidationIssue> {
	return validateRequiredStressors(path, 'compact-vehicle', metadata, REQUIRED_VEHICLE_RISK_PHRASES)
}

function validateRequiredElements(
	path: string,
	identity: string,
	metadata: FixtureMetadata,
	requiredElements: ReadonlyArray<string>,
): Array<FixtureValidationIssue> {
	const elements = joinMetadataEntries(metadata.elements)
	return requiredElements
		.filter((requiredElement) => !elements.includes(requiredElement))
		.map((requiredElement) => ({ path, message: `${identity} fixture must include ${requiredElement}.` }))
}

function validateRequiredStressors(
	path: string,
	identity: string,
	metadata: FixtureMetadata,
	requiredPhrases: ReadonlyArray<string>,
): Array<FixtureValidationIssue> {
	const stressors = joinMetadataEntries([...metadata.stressors.values()].flat())
	return requiredPhrases
		.filter((phrase) => !stressors.includes(phrase))
		.map((phrase) => ({ path, message: `${identity} fixture must declare ${phrase} as a renderer risk.` }))
}

function joinMetadataEntries(entries: ReadonlyArray<string>): string {
	return entries.join('\n').toLowerCase()
}

function parseFixtureMetadata(text: string): FixtureMetadata {
	const draft: FixtureMetadataDraft = {
		// Stryker disable next-line ArrayDeclaration: extra non-required metadata entries are equivalent to ignored fixture comments.
		elements: [],
		stressors: new Map(),
	}

	for (const rawLine of text.split(/\r?\n/)) {
		applyFixtureMetadataLine(draft, rawLine)
	}

	return draft
}

type FixtureMetadataDraft = {
	identity?: string
	elements: Array<string>
	asymmetry?: string
	stressors: Map<string, Array<string>>
}

function applyFixtureMetadataLine(draft: FixtureMetadataDraft, rawLine: string): void {
	const parsedLine = parseFixtureMetadataLine(rawLine)
	if (parsedLine === undefined) {
		return
	}

	applyFixtureMetadataEntry(draft, parsedLine.key, parsedLine.value)
}

function parseFixtureMetadataLine(rawLine: string): { key: string, value: string } | undefined {
	// Stryker disable next-line Regex: removing the terminal anchor is equivalent because the final capture is greedy.
	const match = /^# fixture (identity|element|asymmetry|stressor-(?:silhouette|material|view)): (.+)$/i.exec(rawLine.trim())
	if (match === null) {
		return undefined
	}

	return {
		key: match[1].toLowerCase(),
		value: match[2],
	}
}

function applyFixtureMetadataEntry(draft: FixtureMetadataDraft, key: string, value: string): void {
	if (key === 'identity') {
		draft.identity = value
		return
	}

	if (key === 'element') {
		draft.elements.push(value)
		return
	}

	if (key === 'asymmetry') {
		draft.asymmetry = value
		return
	}

	applyFixtureStressorEntry(draft, key, value)
}

function applyFixtureStressorEntry(draft: FixtureMetadataDraft, key: string, value: string): void {
	const category = key.slice('stressor-'.length)
	// Stryker disable next-line ArrayDeclaration: an extra non-required stressor entry is equivalent to an ignored fixture comment.
	const categoryStressors = draft.stressors.get(category) ?? []
	categoryStressors.push(value)
	draft.stressors.set(category, categoryStressors)
}
