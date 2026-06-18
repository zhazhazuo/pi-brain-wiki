# Debug Guide

## Common issues

| Symptom | Resolution |
|---------|-----------|
| Extension "command:wiki-*" error: "Could not find .wiki/config.json from {path} upward" | The vault root is not discoverable from the current working directory. Check that the vault has a .wiki/config.json either directly or inside a Wiki/ subdirectory at some ancestor of the working directory. |
| Tool writes to inbox/ or meta/ are blocked | These paths are protected by the guard hook. The extension blocks direct write/edit to inbox/** and meta/** files. Use wiki_capture_source to add sources and let the extension rebuild metadata. |
| Generated metadata (registry, backlinks, index) out of date | Generated files are rebuilt automatically on agent end. If they appear stale, trigger a manual rebuild with wiki_rebuild_meta. |
| npm run check fails | Run `npm install` to ensure dependencies are installed. Check that all required source files exist and package.json is valid. |

## Log locations

- No application-level log files — the wiki maintains its own event log at meta/events.jsonl and meta/log.md
- pi-coding-agent logs are managed by the pi runtime
