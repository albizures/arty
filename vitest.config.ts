import { withCrapTypescriptVitest } from '@barney-media/crap-typescript-vitest'

const EXCLUDED_PATHS = ['.stryker-tmp/**/*']

export default withCrapTypescriptVitest(
	{
		test: {
			passWithNoTests: true,
			coverage: {
				provider: 'v8',
				reporter: ['text', 'lcov'],
				include: ['src/**/*.ts'],
				exclude: EXCLUDED_PATHS,
				thresholds: {
					lines: 100,
					branches: 100,
					functions: 100,
					statements: 100,
				},
			},
		},
	},
	{
		threshold: 6,
		agent: true,
		excludes: EXCLUDED_PATHS,
	},
)
