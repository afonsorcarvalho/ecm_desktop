import axios, { AxiosInstance } from 'axios'

export class OdooError extends Error {
  constructor(message: string, public code: number, public debug?: string) {
    super(message)
    this.name = 'OdooError'
  }
}
export class OdooSessionError extends OdooError {
  constructor() { super('Sessão expirada', 401); this.name = 'OdooSessionError' }
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: { code: number; message: string; data: { name: string; debug: string; message: string } }
}

let rid = 1
const nextId = () => rid++
const rpcPayload = (params: Record<string, unknown>) =>
  ({ jsonrpc: '2.0', method: 'call', id: nextId(), params })

function normalizeUrl(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '')
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u
  return u
}

class OdooClient {
  private http: AxiosInstance | null = null
  private baseUrl = ''

  configure(baseUrl: string) {
    this.baseUrl = normalizeUrl(baseUrl)
    // Usa proxy /api/odoo (Next.js route) SEMPRE que renderer estiver servido
    // via HTTP/HTTPS — inclui dev mode em Electron (Next.js localhost:3000)
    // e browser puro. Production build do Electron carrega via file:// e aí
    // não há proxy disponível → fetch direto (Electron tem CSP/CORS relaxado
    // pra renderer file://).
    const isHttp =
      typeof window !== 'undefined' &&
      /^https?:$/i.test(window.location.protocol)
    const useProxy = isHttp
    this.http = axios.create({
      baseURL: useProxy ? '/api/odoo' : this.baseUrl,
      withCredentials: true,
      timeout: 60_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(useProxy ? { 'X-Odoo-Target': this.baseUrl } : {}),
      },
    })
  }

  private ensure(): AxiosInstance {
    if (!this.http) throw new OdooError('Cliente Odoo não configurado (chame configure)', 0)
    return this.http
  }

  async authenticate(db: string, login: string, password: string) {
    const http = this.ensure()
    const { data } = await http.post<JsonRpcResponse<{ uid: number; username: string; user_companies?: any }>>(
      '/web/session/authenticate',
      rpcPayload({ db, login, password }),
    )
    if (data.error) throw new OdooError(data.error.data?.message || data.error.message, data.error.code, data.error.data?.debug)
    if (!data.result?.uid) throw new OdooError('Credenciais inválidas', 401)
    return data.result
  }

  async sessionInfo() {
    const http = this.ensure()
    const { data } = await http.post<JsonRpcResponse<{ uid: number | null; username?: string; db?: string }>>(
      '/web/session/get_session_info',
      rpcPayload({}),
    )
    if (data.error) throw this.toError(data.error)
    return data.result
  }

  async logout() {
    const http = this.ensure()
    await http.post('/web/session/destroy', rpcPayload({}))
  }

  async callKw<T = unknown>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
    const http = this.ensure()
    const { data } = await http.post<JsonRpcResponse<T>>(
      '/web/dataset/call_kw',
      rpcPayload({ model, method, args, kwargs }),
    )
    if (data.error) throw this.toError(data.error)
    return data.result as T
  }

  /** Chama um controller custom do Odoo (route type="json"). O `path` é o
   *  caminho da rota (ex.: '/afr_ecm/semantic_search'); `params` vira o
   *  objeto JSON-RPC `params` que o Odoo mapeia para os kwargs do método. */
  async callRoute<T = unknown>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const http = this.ensure()
    const route = path.startsWith('/') ? path : `/${path}`
    const { data } = await http.post<JsonRpcResponse<T>>(route, rpcPayload(params))
    if (data.error) throw this.toError(data.error)
    return data.result as T
  }

  getBaseUrl() { return this.baseUrl }

  private toError(err: NonNullable<JsonRpcResponse['error']>): OdooError {
    if (err.code === 100 || /Session/i.test(err.data?.message || '')) return new OdooSessionError()
    return new OdooError(err.data?.message || err.message, err.code, err.data?.debug)
  }
}

export const odoo = new OdooClient()
