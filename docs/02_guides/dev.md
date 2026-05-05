# Dev Guide

## Prerequisites

- Node.js >=20
- npm
- pi-coding-agent (peer dependency, installed in host project)

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/walker/pi-brain-wiki.git
   cd pi-brain-wiki
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Dev server

No dev server — this is a pi extension package, not a web application. Testing is done via the host pi environment.

## Test command

```
npm run check
```

Runs `node --experimental-strip-types ./scripts/check.ts` which verifies required files and package.json config.

## Env variables

None required.

## Project structure

- extensions/brain-wiki/index.ts — pi extension entry point, tool registration
- extensions/brain-wiki/src/ — domain modules
- scripts/check.ts — pre-publish integrity checks
- scripts/release.ts — automated versioning and release
