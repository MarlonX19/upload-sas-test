/** Contrato genérico para chamadas HTTP (sem autenticação). */
export interface HttpClient {
  get<T>(url: string, config?: { params?: Record<string, string> }): Promise<T>;
}
