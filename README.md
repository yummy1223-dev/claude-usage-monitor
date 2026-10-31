# usage-monitor

A Claude Code mod that keeps a compact, one-line usage monitor just above the prompt.

```
CTX ▰▰▰▱▱▱▱▱  42% 84k/200k  │  5H ▰▰▰▰▰▰▰▱  91% ↻2h14m  │  7D ▰▰▰▱▱▱▱▱  37% ↻3d04h  │  $1.23
```

- **CTX**: context window fill (tokens used / window size)
- **5H / 7D**: rate-limit windows with time until reset (subscription accounts)
- **$**: cost of the current session

Filled `▰` cells are used, outlined `▱` cells are free. Used cells change tone in muted colors:
green under 60%, amber from 60%, red from 85%. On narrow screens the line wraps to two rows.
Updates after every turn; reset countdowns tick every 30 seconds.

`/usage-monitor` toggles the line on and off.

## Install

This repository is private: installing needs read access to it on GitHub and a git credential
for github.com on your machine (an SSH key, or `gh auth login` then `gh auth setup-git`).

At the prompt of a terminal session:

```
/plugin install usage-monitor --marketplace yummy1223-dev/claude-usage-monitor
```

Answer `y` to add the marketplace, then choose a scope (user scope loads it in every session).

From a shell:

```bash
claude plugin install usage-monitor --marketplace yummy1223-dev/claude-usage-monitor
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with
`yummy1223-dev/claude-usage-monitor`, then Add plugin.
