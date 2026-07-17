import { buildOptions, setupProfile, apiConsoleWorkload, handleSummary } from '../common.js';

export const options = buildOptions('soak', { safety: { requiresWrites: true } });
export function setup() { return setupProfile('soak'); }
export { apiConsoleWorkload, handleSummary };
export default apiConsoleWorkload;
