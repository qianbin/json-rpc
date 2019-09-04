import {
    Payload,
    ParseError,
    RPCError,
    InternalError,
    MethodNotFoundError
} from './types'

export class JSONRPC {
    private readonly _send: (payload: Payload, isRequest: boolean) => Promise<void>
    private readonly _ongoings = new Map<number, {
        resolve: (result: any) => void
        reject: (err: Error) => void
    }>()
    private _nextId = 1
    private _handler?: JSONRPC.Handler
    private _error: Error | null = null

    constructor(send: (data: string, isRequest: boolean) => Promise<void>) {
        this._send = (payload, isRequest) => {
            if (this._error) {
                return Promise.reject(this._error)
            }
            return send(JSON.stringify(payload), isRequest)
        }
    }

    public call(method: string, ...params: any[]) {
        return new Promise<any>(async (resolve, reject) => {
            const id = this._nextId++
            const payload: Payload = {
                jsonrpc: '2.0',
                id,
                method,
                params
            }

            try {
                await this._send(payload, true)
                this._ongoings.set(id, {
                    resolve,
                    reject
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    public notify(method: string, ...params: any[]) {
        const payload: Payload = {
            jsonrpc: '2.0',
            method,
            params
        }
        return this._send(payload, true)
    }

    public async receive(data: string, isRequest: boolean) {
        try {
            let payload: Payload
            try {
                payload = JSON.parse(data) as Payload
            } catch {
                throw new ParseError()
            }
            try {
                if (isRequest) {
                    await this._handleRequest(payload)
                } else {
                    this._handleResponse(payload)
                }
            } catch (err) {
                if (err instanceof RPCError) {
                    throw err
                }
                throw new InternalError(payload.id!)
            }
        } catch (err) {
            if (isRequest) {
                if (err instanceof RPCError) {
                    try {
                        await this._send(err.asPayload(), false)
                        // tslint:disable-next-line: no-empty
                    } catch {
                    }
                }
            }
        }
    }
    public setError(err: Error | null) {
        this._error = err
        if (err) {
            const values = Array.from(this._ongoings.values())
            this._ongoings.clear()
            values.forEach(v => v.reject(err))
        }
    }

    public serve(handler: JSONRPC.Handler) {
        this._handler = handler
    }

    private async _handleRequest(payload: Payload) {
        const impl = this._handler ? this._handler(payload.method!) : undefined
        if (impl) {
            const result = await impl(...payload.params!)
            if (payload.id) {
                await this._send({
                    jsonrpc: '2.0',
                    id: payload.id,
                    result
                    // tslint:disable-next-line: no-empty
                }, false).catch(() => { })
            }
            return
        }

        if (payload.id) {
            throw new MethodNotFoundError(payload.id)
        }
    }

    private _handleResponse(payload: Payload) {
        const ongoing = this._ongoings.get(payload.id!)
        if (!ongoing) {
            return
        }
        this._ongoings.delete(payload.id!)
        if (payload.error) {
            ongoing.reject(new Error(`${payload.error.message} (${payload.error.code})`))
        } else {
            ongoing.resolve(payload.result)
        }
    }
}

export namespace JSONRPC {
    export type MethodImpl = (...args: any[]) => any
    export type Handler = (method: string) => (MethodImpl | undefined)
}
