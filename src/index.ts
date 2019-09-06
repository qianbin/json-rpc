import * as T from './types'

/** Transport-independent JSON RPC 2.0 protocol stack */
export class JSONRPC {
    private readonly _send: (payload: T.Payload, isRequest: boolean) => Promise<void>
    private readonly _generateId: () => (number | string)
    private readonly _ongoings = new Map<number | string, {
        resolve: (result: any) => void
        reject: (err: Error) => void
    }>()
    private _handler?: JSONRPC.Handler
    private _error: Error | null = null

    /**
     * create JSON RPC instance
     * @param send the function to transmit JSON RPC payload
     * @param generateId function to generate request id. If omitted, the default  auto-increment function is used.
     */
    constructor(send: JSONRPC.Send, generateId?: () => (number | string)) {
        this._send = (payload, isRequest) => {
            if (this._error) {
                return Promise.reject(this._error)
            }
            return send(JSON.stringify(payload), isRequest)
        }
        if (generateId) {
            this._generateId = generateId
        } else {
            let nextId = 0
            this._generateId = () => {
                return nextId++
            }
        }
    }

    /**
     * Call to remote method
     * @param method the method name
     * @param params params for method
     * @returns promised method return value
     */
    public call(method: string, ...params: any[]) {
        const id = this._generateId()
        const payload: T.Payload = {
            jsonrpc: '2.0',
            id,
            method,
            params
        }

        return new Promise<any>((resolve, reject) => {
            // send request payload, and then add to ongoing list to wait for response
            this._send(payload, true)
                .then(() => {
                    this._ongoings.set(id, {
                        resolve,
                        reject
                    })
                }).catch(reject)
        })
    }

    /**
     * Send a notification
     * @param method the notification name
     * @param params params for notification
     */
    public notify(method: string, ...params: any[]) {
        const payload: T.Payload = {
            jsonrpc: '2.0',
            method,
            params
        }
        return this._send(payload, true)
    }

    /**
     * to receive and process JSON RPC payload
     * @param data JSON encoded payload
     * @param isRequest whether the payload is request type
     */
    public async receive(data: string, isRequest: boolean) {
        let payload: T.Payload
        try {
            payload = JSON.parse(data) as T.Payload
            T.Payload.validate(payload, isRequest)
        } catch (err) {
            throw new T.ParseError(err)
        }

        if (isRequest) {
            await this._handleRequest(payload)
        } else {
            this._handleResponse(payload)
        }
    }

    /**
     * Set to error state, or clear error state.
     * In error state, all subsequent calls will fail immediately.
     * @param err error object
     */
    public setError(err: Error | null) {
        this._error = err
        if (err) {
            const values = Array.from(this._ongoings.values())
            this._ongoings.clear()
            values.forEach(v => v.reject(err))
        }
    }

    /**
     * serve method handler
     * @param handler handle method calls
     */
    public serve(handler: JSONRPC.Handler) {
        this._handler = handler
    }

    private async _handleRequest(payload: T.Payload) {
        const impl = this._handler ? this._handler(payload.method!) : undefined
        const hasId = payload.id !== undefined && payload.id !== null
        if (impl) {
            let result

            try {
                result = await impl(payload.params!)
            } catch (err) {
                if (!hasId) {
                    throw err
                }
                if (err instanceof T.BaseError) {
                    await this._send(err.asPayload(), false)
                } else {
                    await this._send(new T.InternalError(payload.id!, err).asPayload(), false)
                }
                return
            }

            if (hasId) {
                await this._send({
                    jsonrpc: '2.0',
                    id: payload.id,
                    result
                }, false)
            }

        } else {
            const err = new T.MethodNotFoundError(payload.id!)
            if (hasId) {
                await this._send(new T.MethodNotFoundError(payload.id!).asPayload(), false)
            } else {
                throw err
            }
        }
    }

    private _handleResponse(payload: T.Payload) {
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
    export type Send = (data: string, isRequest: boolean) => Promise<void>
    export type MethodImpl = (args: any[]) => any
    export type Handler = (method: string) => (MethodImpl | undefined)
}
