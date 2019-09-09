import * as V from 'validator-ts'

/** defines JSON-RPC 2.0 payload */
export interface Payload {
    jsonrpc: '2.0'
    id?: number | string | null

    // for request
    method?: string
    params?: any[]

    // for response
    result?: any
    error?: {
        code: number
        message: string
        data?: any
    }
}

export namespace Payload {
    const baseScheme: V.Scheme<Payload> = {
        jsonrpc: v => v === '2.0' ? '' : `expected '2.0'`,
        id: V.nullable(V.optional(
            v => (typeof v === 'number' || typeof v === 'string') ? '' : 'expected number or string')),
        method: () => '',
        params: () => '',
        result: () => '',
        error: () => ''
    }

    const requestScheme: V.Scheme<Payload> = {
        ...baseScheme,
        method: V.optional(v => (typeof v === 'string' && v.length > 0) ? '' : 'expected string'),
        params: v => Array.isArray(v) ? '' : 'expected array'
    }

    const responseScheme: V.Scheme<Payload> = {
        ...baseScheme,
        error: V.optional({
            code: v => typeof v === 'number' ? '' : 'expected number',
            message: v => typeof v === 'string' ? '' : 'expected string',
            data: () => ''
        })
    }

    /** validate payload */
    export function validate(payload: Payload, isRequest: boolean) {
        V.validate(payload, isRequest ? requestScheme : responseScheme)
    }
}

/** base error type */
export class BaseError extends Error {
    constructor(
        message: string,
        readonly code: number,
        readonly data?: any) {
        super(message)
    }

    public asPayload(id?: number | string | null): Payload {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: this.code,
                message: this.message,
                data: this.data
            }
        }
    }
}

export class ParseError extends BaseError {
    constructor(err: Error) {
        super(`Parse error: ${err.message}`, -32700)
    }
}

export class InvalidRequestError extends BaseError {
    constructor(err: Error) {
        super(`Invalid request: ${err.message}`, -32600)
    }
}

export class MethodNotFoundError extends BaseError {
    constructor() {
        super('Method not found', -32601)
    }
}

export class InternalError extends BaseError {
    constructor(err: Error) {
        super(`Internal error: ${err.message}`, -32603)
    }
}
