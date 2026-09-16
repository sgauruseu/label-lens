import { defineConfig, devices } from '@playwright/test';

/**
 * UI tests run against the **production build**, not the dev server.
 *
 * That is deliberate: the unit tests already cover the domain logic, so the only thing these
 * add is confidence in what the assembled, minified, actually-deployed application shows. A dev
 * server would test a different artefact from the one that reaches GitHub Pages.
 *
 * `VITE_BASE=/` so the build is served from the root here; CI sets the repository sub-path for
 * the real deploy.
 */
/**
 * Windows reserves blocks of TCP ports for Hyper-V and WSL, and binding inside one fails with
 * `EACCES` even though nothing is listening there — which is what Vite's usual 4173 ran into on
 * a developer machine, where everything from 4043 to 4642 was reserved. 4800 sits outside the
 * blocks Windows hands out by default. If it collides on another machine, run
 * `netsh interface ipv4 show excludedportrange protocol=tcp` and set `UI_TEST_PORT` to a free one.
 */
const PORT = Number(process.env.UI_TEST_PORT ?? 4800);
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Sandboxes and CI runners often carry a pre-installed Chromium that does not match the
        // revision this Playwright version would download. Point at it when the environment
        // says where it is; otherwise use Playwright's own browser, as CI does.
        ...(process.env.CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.CHROMIUM_PATH,
                // The app makes no third-party requests in offline mode; the browser still tries
                // to phone home on startup, which stalls behind a restrictive proxy.
                args: ['--disable-background-networking', '--disable-component-update'],
              },
            }
          : {}),
      },
    },
  ],

  webServer: {
    // `--host 127.0.0.1` keeps the server off the IPv6 loopback, which is where the Windows
    // reservation usually bites first.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    // Both halves need it: the build writes the asset paths, and `vite preview` reads the same
    // config to decide what path to serve from. Setting it inline on the build alone leaves the
    // preview server answering on /label-lens/ and every test timing out on a redirect.
    env: { VITE_BASE: '/' },
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
