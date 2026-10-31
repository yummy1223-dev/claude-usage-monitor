import { expect, test } from 'claude-code/testing'

const BAND = (bodyColumns: number) =>
  ({
    plugin: 'usage-monitor',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

test('the pane shows context, limits and cost', async ($, on) => {
  on('command.register', () => ({ value: { command: 'usage-monitor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: Date.parse('2026-10-31T10:00:00Z') }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 84200, window: 200000, percent: 42 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 91, resetsAt: '2026-10-31T12:14:00Z' },
        { kind: 'seven_day', percentUsed: 37 },
      ],
      cost: { usd: 1.234 },
    },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND(surface === 'mobile' ? 40 : 120), surface })
    expect((await ui.find({ type: 'Text', text: /84k\/200k/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /↻2h14m/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /91%/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: '$1.23' }))).toBeTruthy()
    await ui.unmount()
  }
})
