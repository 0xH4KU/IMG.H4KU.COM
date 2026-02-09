// @ts-check

/**
 * @typedef {{
 *   name: string;
 *   required: boolean;
 *   warning?: string;
 * }} EnvVarCheck
 */

/** @type {EnvVarCheck[]} */
const ENV_CHECKS = [
  { name: 'R2', required: true, warning: 'R2 bucket binding is required' },
  { name: 'ADMIN_PASSWORD', required: true, warning: 'ADMIN_PASSWORD is required for authentication' },
  { name: 'JWT_SECRET', required: false, warning: 'JWT_SECRET not set, falling back to ADMIN_PASSWORD' },
];

/**
 * @typedef {{
 *   ok: boolean;
 *   errors: string[];
 *   warnings: string[];
 * }} EnvCheckResult
 */

/**
 * Validate environment variables at startup
 * @param {Record<string, unknown>} env
 * @returns {EnvCheckResult}
 */
export function validateEnv(env) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  for (const check of ENV_CHECKS) {
    const value = env?.[check.name];
    const isSet = value !== undefined && value !== null && value !== '';

    if (check.required && !isSet) {
      errors.push(check.warning || `Missing required env: ${check.name}`);
    } else if (!check.required && !isSet && check.warning) {
      warnings.push(check.warning);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check env and return 500 response if invalid
 * @param {Record<string, unknown>} env
 * @returns {Response | null}
 */
export function checkEnvOrFail(env) {
  const result = validateEnv(env);

  if (!result.ok) {
    console.error('[ENV] Configuration errors:', result.errors);
    return new Response('Server configuration error', { status: 500 });
  }

  if (result.warnings.length > 0) {
    console.warn('[ENV] Configuration warnings:', result.warnings);
  }

  return null;
}
