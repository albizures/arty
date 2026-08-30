import antfu from '@antfu/eslint-config'

export default antfu({
	formatters: true,
	react: true,
	typescript: true,
	stylistic: {
		indent: 'tab',
	},
	rules: {
		'ts/consistent-type-definitions': ['error', 'type'],
		'ts/array-type': ['error', { default: 'generic', readonly: 'generic' }],
		'arrow-parens': ['error', 'always'],
		'style/arrow-parens': ['error', 'always'],
		'curly': ['error', 'all'],
	},
})
