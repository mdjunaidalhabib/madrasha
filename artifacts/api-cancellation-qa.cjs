const assert = require('node:assert/strict');
const { build } = require('../node_modules/esbuild');

(async () => {
  const result = await build({
    entryPoints: ['admin/src/services/api.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: ['axios'],
    plugins: [{ name: 'mock-app-state', setup(build) {
      build.onResolve({ filter: /store\/|shared-ui\/src\/(i18n|services\/apiConfig)/ }, args => ({ path: args.path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => {
        if (args.path.endsWith('/i18n')) return { contents: 'export const defineText = t => t; export const attachLanguageHeader = () => {}; export const getLang = () => "en"; export const getText = t => t.en; export const localizeDigits = n => String(n);' };
        if (args.path.endsWith('/apiConfig')) return { contents: 'export const API_BASE_URL = "http://localhost/api";' };
        const name = args.path.includes('adminDomainStore') ? 'useAdminDomainStore' : args.path.includes('authStore') ? 'useAuthStore' : args.path.includes('planStore') ? 'usePlanStore' : 'useToastStore';
        return { contents: `export const ${name} = { getState: () => ({ push: (...args) => globalThis.__cancelQaToasts.push(args) }) };` };
      });
    } }],
  });
  const compiled = new module.constructor();
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, 'api-cancellation-qa.cjs');
  const api = compiled.exports.default;
  const axios = require('axios');
  globalThis.__cancelQaToasts = [];

  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = api.get('/students/lookup', {
    signal: controller.signal,
    adapter: config => new Promise((resolve, reject) => {
      config.signal.addEventListener('abort', () => reject(new axios.CanceledError('canceled', config)), { once: true });
      started();
    }),
  });
  await ready;
  controller.abort();
  await assert.rejects(pending, error => axios.isCancel(error));
  assert.deepEqual(globalThis.__cancelQaToasts, []);

  await assert.rejects(api.get('/students/admission/search', {
    adapter: config => Promise.reject(new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status: 500, data: { message: 'Search unavailable' } })),
  }));
  assert.deepEqual(globalThis.__cancelQaToasts, [['error', 'Search unavailable']]);
  console.log('PASS: canceled lookup rejects without a toast; real API failures still show their error.');
})().catch(error => { console.error(error); process.exitCode = 1; });

