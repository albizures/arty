/* eslint-disable jsdoc/require-returns-description */
/* eslint-disable jsdoc/require-param-description */
import { PluginKind, declareValuePlugin } from '@stryker-mutator/api/plugin';

const IGNORE_REASON = 'assert message strings are not behavior under test';

/**
 * @param {import('@stryker-mutator/core').babel.NodePath} path
 * @returns {string | undefined}
 */
function shouldIgnoreAssertMessage(path) {
	if (!path.isStringLiteral() && !path.isTemplateLiteral()) {
		return undefined;
	}

	if (path.listKey !== 'arguments' || path.key !== 1) {
		return undefined;
	}

	const parent = path.parentPath;
	if (parent === null || !parent.isCallExpression()) {
		return undefined;
	}

	const { callee } = parent.node;
	if (callee.type !== 'Identifier' || callee.name !== 'assert') {
		return undefined;
	}

	return IGNORE_REASON;
}

export const strykerPlugins = [
	declareValuePlugin(PluginKind.Ignore, 'assert-messages', {
		shouldIgnore: shouldIgnoreAssertMessage,
	}),
];
