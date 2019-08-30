export interface Payload {
    jsonrpc: '2.0'
    id?: number
    // request only
    method?: string
    params?: any[]

    // response only
    result?: any
    error?: {
        code: number
        message: string
        data?: any
    }
}

// TODO
// export namespace Payload {
//     export function validate(payload: Payload) {
//     }
// }

export class RPCError extends Error {
    constructor(
        message: string,
        readonly code: number,
        readonly id?: number) {
        super(message)
    }

    public asPayload(): Payload {
        return {
            jsonrpc: '2.0',
            id: this.id,
            error: {
                code: this.code,
                message: this.message
            }
        }
    }
}

export class ParseError extends RPCError {
    constructor() {
        super('Parse error', -32700)
    }
}

export class InvalidRequestError extends RPCError {
    constructor() {
        super('Invalid request', -32600)
    }
}

export class MethodNotFoundError extends RPCError {
    constructor(id: number) {
        super('Method not found', -32601, id)
    }
}

export class InvalidParamsError extends RPCError {
    constructor(id: number) {
        super('Invalid params', -32602, id)
    }
}

export class InternalError extends RPCError {
    constructor(id: number) {
        super('Internal error', -32603, id)
    }
}

export class ServerError extends RPCError {
    constructor(id: number, code: number, readonly data: any) {
        super('Server error', code, id)
    }

    public asPayload(): Payload {
        return {
            jsonrpc: '2.0',
            id: this.id,
            error: {
                code: this.code,
                message: this.message,
                data: this.data
            }
        }
    }
}
