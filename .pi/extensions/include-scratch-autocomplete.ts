import process from 'node:process'

const EXTRA_ROOTS = ['.scratch']
const MAX_SUGGESTIONS = 20
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.stryker-tmp'])

type ExecResult = {
	stdout: string
	code: number
}

type ExtensionAPI = {
	exec: (command: string, args: Array<string>, options?: { cwd?: string, timeout?: number, signal?: AbortSignal }) => Promise<ExecResult>
	on: (event: 'session_start', handler: (_event: unknown, ctx: ExtensionContext) => void) => void
}

type ExtensionContext = {
	cwd: string
	ui: {
		addAutocompleteProvider: (factory: (current: AutocompleteProvider) => AutocompleteProvider) => void
	}
}

type AutocompleteItem = {
	value: string
	label: string
	description?: string
}

type AutocompleteSuggestions = {
	items: Array<AutocompleteItem>
	prefix: string
}

type AutocompleteProvider = {
	triggerCharacters?: Array<string>
	getSuggestions: (
		lines: Array<string>,
		cursorLine: number,
		cursorCol: number,
		options: { signal: AbortSignal, force?: boolean },
	) => Promise<AutocompleteSuggestions | null>
	applyCompletion: (
		lines: Array<string>,
		cursorLine: number,
		cursorCol: number,
		item: AutocompleteItem,
		prefix: string,
	) => { lines: Array<string>, cursorLine: number, cursorCol: number }
	shouldTriggerFileCompletion?: (lines: Array<string>, cursorLine: number, cursorCol: number) => boolean
}

type AtPrefix = {
	prefix: string
	query: string
	quoted: boolean
}

type ScratchEntry = {
	path: string
	isDirectory: boolean
}

type ScoredEntry = {
	entry: ScratchEntry
	score: number
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, '/')
}

function pathBasename(path: string): string {
	const normalized = normalizePath(path).replace(/\/$/, '')
	const slashIndex = normalized.lastIndexOf('/')
	return slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1)
}

function extractAtPrefix(textBeforeCursor: string): AtPrefix | undefined {
	const quoted = textBeforeCursor.match(/(?:^|[ \t])@"([^"]*)$/)
	if (quoted) {
		return { prefix: `@"${quoted[1] ?? ''}`, query: quoted[1] ?? '', quoted: true }
	}

	const unquoted = textBeforeCursor.match(/(?:^|[ \t])@([^\s"]*)$/)
	if (!unquoted) {
		return undefined
	}

	return { prefix: `@${unquoted[1] ?? ''}`, query: unquoted[1] ?? '', quoted: false }
}

async function listEntries(pi: ExtensionAPI, cwd: string, root: string, signal: AbortSignal): Promise<Array<ScratchEntry>> {
	const script = `
const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");
const root = process.argv[1];
const excluded = new Set(${JSON.stringify(Array.from(EXCLUDED_DIRECTORIES))});
const results = [];
function walk(relativePath) {
  const absolutePath = join(process.cwd(), relativePath);
  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    results.push({ path: relativePath.replace(/\\\\/g, "/") + "/", isDirectory: true });
    let entries;
    try {
      entries = readdirSync(absolutePath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && excluded.has(entry.name)) continue;
      walk(join(relativePath, entry.name));
    }
    return;
  }
  if (stat.isFile()) {
    results.push({ path: relativePath.replace(/\\\\/g, "/"), isDirectory: false });
  }
}
walk(root);
process.stdout.write(JSON.stringify(results));
`

	const result = await pi.exec(process.execPath, ['-e', script, root], { cwd, timeout: 5_000, signal })
	if (result.code !== 0 || signal.aborted) {
		return []
	}

	try {
		const parsed: unknown = JSON.parse(result.stdout)
		return isScratchEntries(parsed) ? parsed : []
	}
	catch {
		return []
	}
}

function isScratchEntries(value: unknown): value is Array<ScratchEntry> {
	return Array.isArray(value) && value.every(isScratchEntry)
}

function isScratchEntry(value: unknown): value is ScratchEntry {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as ScratchEntry).path === 'string'
		&& typeof (value as ScratchEntry).isDirectory === 'boolean'
}

function scoreEntry(path: string, query: string, isDirectory: boolean): number {
	const normalizedPath = normalizePath(path).replace(/\/$/, '')
	const normalizedQuery = normalizePath(query).replace(/^@?/, '').replace(/^\./, '').toLowerCase()
	if (!normalizedQuery) {
		return normalizedPath.split('/').length === 1 ? 100 : 1
	}

	const lowerPath = normalizedPath.toLowerCase()
	const lowerBaseName = pathBasename(normalizedPath).toLowerCase()
	let score = 0

	if (lowerPath === normalizedQuery || lowerPath === `.${normalizedQuery}`) {
		score = 120
	}
	else if (lowerBaseName === normalizedQuery) {
		score = 100
	}
	else if (lowerPath.startsWith(normalizedQuery) || lowerPath.startsWith(`.${normalizedQuery}`)) {
		score = 90
	}
	else if (lowerBaseName.startsWith(normalizedQuery)) {
		score = 80
	}
	else if (lowerBaseName.includes(normalizedQuery)) {
		score = 60
	}
	else if (lowerPath.includes(normalizedQuery)) {
		score = 40
	}
	else if (isSubsequence(normalizedQuery, lowerPath)) {
		score = 20
	}

	return isDirectory && score > 0 ? score + 5 : score
}

function isSubsequence(query: string, value: string): boolean {
	let queryIndex = 0
	for (const char of value) {
		if (char === query[queryIndex]) {
			queryIndex += 1
		}
		if (queryIndex === query.length) {
			return true
		}
	}
	return false
}

function formatCompletion(entry: ScratchEntry, quoted: boolean): AutocompleteItem {
	const path = normalizePath(entry.path)
	const value = quoted || path.includes(' ') ? `@"${path}"` : `@${path}`
	return {
		value,
		label: `${pathBasename(path)}${entry.isDirectory ? '/' : ''}`,
		description: path,
	}
}

function mergeSuggestions(
	baseSuggestions: AutocompleteSuggestions | null,
	extraItems: Array<AutocompleteItem>,
	prefix: string,
): AutocompleteSuggestions | null {
	const items: Array<AutocompleteItem> = []
	const seen = new Set<string>()

	for (const item of baseSuggestions?.items ?? []) {
		if (seen.has(item.value)) {
			continue
		}
		seen.add(item.value)
		items.push(item)
		if (items.length >= MAX_SUGGESTIONS) {
			return { prefix, items }
		}
	}

	for (const item of extraItems) {
		if (seen.has(item.value)) {
			continue
		}
		seen.add(item.value)
		items.push(item)
		if (items.length >= MAX_SUGGESTIONS) {
			break
		}
	}

	return items.length > 0 ? { prefix, items } : null
}

function createScratchAutocompleteProvider(pi: ExtensionAPI, cwd: string, current: AutocompleteProvider): AutocompleteProvider {
	let entriesCache: Array<ScratchEntry> | undefined
	let entriesPromise: Promise<Array<ScratchEntry>> | undefined

	async function getEntries(signal: AbortSignal): Promise<Array<ScratchEntry>> {
		if (entriesCache) {
			return entriesCache
		}

		entriesPromise ||= loadEntries(pi, cwd, signal)

		const entries = await entriesPromise
		entriesPromise = undefined
		if (!signal.aborted) {
			entriesCache = entries
		}
		return entries
	}

	return {
		triggerCharacters: Array.from(new Set([...(current.triggerCharacters ?? []), '@'])),

		async getSuggestions(lines, cursorLine, cursorCol, options) {
			const currentSuggestions = await current.getSuggestions(lines, cursorLine, cursorCol, options)
			const line = lines[cursorLine] ?? ''
			const token = extractAtPrefix(line.slice(0, cursorCol))
			if (!token || options.signal.aborted) {
				return currentSuggestions
			}

			const entries = await getEntries(options.signal)
			if (options.signal.aborted) {
				return currentSuggestions
			}

			const extraItems = entries
				.map((entry): ScoredEntry => ({ entry, score: scoreEntry(entry.path, token.query, entry.isDirectory) }))
				.filter(({ score }) => score > 0)
				.sort(compareScoredEntries)
				.slice(0, MAX_SUGGESTIONS)
				.map(({ entry }) => formatCompletion(entry, token.quoted))

			return mergeSuggestions(currentSuggestions, extraItems, token.prefix)
		},

		applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
			return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix)
		},

		shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
			return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true
		},
	}
}

async function loadEntries(pi: ExtensionAPI, cwd: string, signal: AbortSignal): Promise<Array<ScratchEntry>> {
	const entriesByPath = new Map<string, ScratchEntry>()
	for (const root of EXTRA_ROOTS) {
		if (signal.aborted) {
			break
		}
		for (const entry of await listEntries(pi, cwd, root, signal)) {
			entriesByPath.set(normalizePath(entry.path), entry)
		}
	}
	return Array.from(entriesByPath.values())
}

function compareScoredEntries(left: ScoredEntry, right: ScoredEntry): number {
	const scoreDiff = right.score - left.score
	if (scoreDiff !== 0) {
		return scoreDiff
	}

	const depthDiff = left.entry.path.split('/').length - right.entry.path.split('/').length
	if (depthDiff !== 0) {
		return depthDiff
	}

	return left.entry.path.localeCompare(right.entry.path)
}

export default function (pi: ExtensionAPI): void {
	pi.on('session_start', (_event, ctx) => {
		ctx.ui.addAutocompleteProvider((current) => createScratchAutocompleteProvider(pi, ctx.cwd, current))
	})
}
