type AnyResult = Success | Failure;

export type Failure<TKind extends string = string, TError extends Error = Error, TData = unknown> = {
	kind: TKind;
	error?: TError;
	data: TData;
};

export type Success<TKind extends string = string, TData = unknown> = {
	kind: TKind;
	data: TData;
};

export function success<TKind extends string, TData>(kind: TKind, data: TData): Success<TKind, TData> {
	return { kind, data };
}

/* eslint-disable no-redeclare -- TypeScript call-signature overloads */
export function failure<TKind extends string, TData>(
	kind: TKind,
	data: TData,
): Failure<TKind, never, TData>;
export function failure<TKind extends string, TData, TError extends Error>(
	kind: TKind,
	data: TData,
	error: TError,
): Failure<TKind, TError, TData>;
export function failure<TKind extends string, TData, TError extends Error>(
	kind: TKind,
	data: TData,
	error?: TError,
): Failure<TKind, TError, TData> {
	if (error === undefined) {
		return { kind, data } as Failure<TKind, TError, TData>;
	}

	return { kind, data, error };
}
/* eslint-enable no-redeclare */

type ThrowableInput<TArgs> = {
	args: TArgs
};

export function fromSyncThrowable<
// eslint-disable-next-line @typescript-eslint/no-explicit-any
	TArgs extends ReadonlyArray<any>,
	TOut,
	TFn extends (...args: TArgs) => TOut,
	TResult extends AnyResult,
>(
	fn: TFn,
	mapResult: (output?: TOut, error?: unknown) => TResult,
): (input: ThrowableInput<TArgs>) => TResult {
	return (input: ThrowableInput<TArgs>): TResult => {
		let output: TOut;
		try {
			output = fn(...input.args);
		} catch (error: unknown) {
			return mapResult(undefined, error);
		}

		return mapResult(output);
	};
}

export function fromThrowable<
// eslint-disable-next-line @typescript-eslint/no-explicit-any
	TArgs extends ReadonlyArray<any>,
	TOut,
	TFn extends (...args: TArgs) => Promise<TOut>,
	TResult extends AnyResult,
>(
	fn: TFn,
	mapResult: (output?: TOut, error?: unknown) => TResult,
): (input: ThrowableInput<TArgs>) => Promise<TResult> {
	return async (input: ThrowableInput<TArgs>): Promise<TResult> => {
		let output: TOut;
		try {
			output = await fn(...input.args);
		} catch (error: unknown) {
			return mapResult(undefined, error);
		}

		return mapResult(output);
	};
}
