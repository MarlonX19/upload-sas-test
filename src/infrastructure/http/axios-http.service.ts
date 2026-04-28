import axios, { type AxiosInstance } from "axios";

import type { HttpClient } from "@/application/ports/http-client.port";

/**
 * Cliente HTTP simples — sem interceptors de auth, sem headers dinâmicos.
 */
export class AxiosHttpService implements HttpClient {
  private readonly client: AxiosInstance;

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      validateStatus: (s) => s >= 200 && s < 300,
    });
  }

  async get<T>(url: string, config?: { params?: Record<string, string> }): Promise<T> {
    const res = await this.client.get<T>(url, { params: config?.params });
    return res.data;
  }
}
