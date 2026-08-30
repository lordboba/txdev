import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const loadConfig = require('next/dist/server/config').default;
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
const {
  blockCrossSiteDEV,
} = require('next/dist/server/lib/router-utils/block-cross-site-dev');

const projectDir = path.dirname(fileURLToPath(import.meta.url));

test('allows dev resources requested from the LAN preview host', async () => {
  const config = await loadConfig(PHASE_DEVELOPMENT_SERVER, projectDir);
  const response = {
    statusCode: 200,
    end() {},
  };

  const blocked = blockCrossSiteDEV(
    {
      url: '/_next/webpack-hmr',
      headers: { origin: 'http://192.168.1.234:3000' },
    },
    response,
    config.allowedDevOrigins,
    'localhost',
  );

  assert.equal(blocked, false);
  assert.equal(response.statusCode, 200);
});
