export type Limit = { kind: string; percent: number; resetsAt?: string }

export type Snapshot = {
  ctxPercent?: number
  ctxTokens?: number
  ctxWindow: number
  limits: Limit[]
  usd?: number
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-monitor': { snap: Shaped<Snapshot | null>; isHidden: boolean }
  }
}
