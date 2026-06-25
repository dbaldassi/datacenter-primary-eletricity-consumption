
export class Result<T, E extends Error> {
    #ok: T | null = null;
    #error: E | null = null;

    constructor(ok: T | null, error: E| null) {
        if(!ok && !error) {
            throw new Error("Result must either have a value or error");
        }

        if(ok && error) {
            throw new Error("OK and error can't both have a value");
        }

        if(ok) this.#ok = ok;
        else this.#error = error;
    }

    isOk(): this is Result<T, never> { return this.#ok !== null; }
    isError(): this is Result<never, E> { return this.#error !== null; }

    unwrap(): T {
        if(this.isOk()) {
            return this.#ok as T;
        }

        if (this.isError()) {
            throw this.#error as E;
        }

        throw new Error("Unknown error");
    }

    get_err(): this extends Result<never, E> ? E: E | null {
        return this.#error as E;
    }
}
