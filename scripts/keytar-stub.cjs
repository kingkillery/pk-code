// Lightweight stub to bypass native keytar in environments where the binary isn't compatible.
// Inject with: NODE_OPTIONS="--require /abs/path/to/scripts/keytar-stub.cjs"
// It intercepts require('keytar') and returns a harmless mock.

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
const Module = require('module');
const originalRequire = Module.prototype.require;

function isKeytarRequest(id) {
  if (!id) return false;
  const s = String(id).toLowerCase().replace(/\\/g, '/');
  if (s === 'keytar') return true;
  // Intercept the library file itself
  if (s.includes('/node_modules/keytar/lib/keytar.js')) return true;
  // Intercept any path segment containing keytar
  if (s.includes('/keytar/')) return true;
  // Intercept native binding regardless of relative or absolute path
  if (s.endsWith('keytar.node')) return true;
  return false;
}

Module.prototype.require = function patchedRequire(id) {
  if (isKeytarRequest(id)) {
    // Minimal API surface commonly used
    const noop = async () => undefined;
    return {
      getPassword: noop,
      setPassword: noop,
      deletePassword: noop,
      findCredentials: async () => [],
      findPassword: noop,
    };
  }
  return originalRequire.apply(this, arguments);
};
