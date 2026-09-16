/**
 * Build the application and serve it, so a browser has something to drive.
 *
 * Playwright does this with a four-line `webServer` block in its config. Neither the WebdriverIO
 * test runner nor plain Mocha has such a concept, so it is written out here once and shared by
 * both of them: `wdio.conf.js` calls it from `onPrepare`/`onComplete`, and the standalone setup
 * calls it from Mocha's root hooks.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const IS_WINDOWS = process.platform === 'win32';

/** @type {import('node:child_process').ChildProcess | undefined} */
let server;

/** Runs a command to completion, rejecting on a non-zero exit. */
function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'ignore', shell: IS_WINDOWS });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)),
    );
  });
}

/** Polls until the server answers, because nothing above this will wait for it. */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`responded ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`No server on ${url} after ${timeoutMs} ms (last: ${lastError?.message})`);
}

/**
 * Builds `dist/` and serves it at `url`. Safe to call when a server is already listening.
 *
 * @param {string} url
 * @param {number} port
 */
export async function startAppServer(url, port) {
  try {
    const response = await fetch(url);
    if (response.ok) return; // Something is already serving — reuse it, as Playwright does.
  } catch {
    // Nothing there yet, which is the normal case.
  }

  const env = { ...process.env, VITE_BASE: '/' };
  await run('npm', ['run', 'build'], env);

  server = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { env, stdio: 'ignore', shell: IS_WINDOWS },
  );

  await waitForServer(url, 120_000);
}

/** Stops the server this module started. A reused server is left alone. */
export function stopAppServer() {
  server?.kill();
  server = undefined;
}
