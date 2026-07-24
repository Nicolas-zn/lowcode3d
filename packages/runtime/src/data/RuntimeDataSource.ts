import type { DataSourceConfig } from '@lowcode3d/shared'

export class RuntimeDataSource {
  private dataSources = new Map<string, DataSourceConfig>()
  private values = new Map<string, unknown>()

  bindDataSources(dataSources: DataSourceConfig[]): void {
    this.dataSources.clear()
    dataSources.forEach((source) => {
      if (source.enabled) {
        this.dataSources.set(source.id, source)
        if (source.sampleData !== undefined) {
          this.values.set(source.id, source.sampleData)
        }
      }
    })
  }

  setDataSourceData(sourceId: string, data: unknown): void {
    this.values.set(sourceId, data)
  }

  getDataSourceData(sourceId: string): unknown {
    return this.values.get(sourceId)
  }

  async refreshDataSource(sourceId: string): Promise<unknown> {
    const source = this.dataSources.get(sourceId)
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`)
    }

    const data = await this.loadDataSource(source)
    this.values.set(sourceId, data)
    return data
  }

  async refreshAll(): Promise<Map<string, unknown>> {
    const refreshed = new Map<string, unknown>()

    for (const source of this.dataSources.values()) {
      const data = await this.refreshDataSource(source.id)
      refreshed.set(source.id, data)
    }

    return refreshed
  }

  private async loadDataSource(source: DataSourceConfig): Promise<unknown> {
    if (source.type === 'staticJson') {
      return this.loadStaticJson(source)
    }

    if (source.type === 'http') {
      return this.loadHttp(source)
    }

    if (source.sampleData !== undefined) {
      return source.sampleData
    }

    throw new Error('WebSocket data sources require SDK data injection in this version')
  }

  private loadStaticJson(source: DataSourceConfig): unknown {
    const value = source.config.value ?? source.sampleData ?? {}
    if (typeof value === 'string') {
      return JSON.parse(value)
    }
    return value
  }

  private async loadHttp(source: DataSourceConfig): Promise<unknown> {
    const url = source.config.url
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error(`HTTP data source missing URL: ${source.id}`)
    }

    const response = await fetch(url, {
      method: typeof source.config.method === 'string' ? source.config.method : 'GET',
      headers: this.createHeaders(source),
    })
    if (!response.ok) {
      throw new Error(`HTTP data source failed: ${response.status}`)
    }

    return response.json()
  }

  private createHeaders(source: DataSourceConfig): HeadersInit | undefined {
    if (source.authMode === 'bearer' && typeof source.config.token === 'string') {
      return { Authorization: `Bearer ${source.config.token}` }
    }
    if (source.authMode === 'customHeader') {
      const key = source.config.headerKey
      const value = source.config.headerValue
      if (typeof key === 'string' && typeof value === 'string') {
        return { [key]: value }
      }
    }
    return undefined
  }

  clear(): void {
    this.dataSources.clear()
    this.values.clear()
  }
}
