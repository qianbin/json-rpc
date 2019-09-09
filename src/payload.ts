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
