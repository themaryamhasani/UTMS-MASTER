import { buildOptions, setupProfile, apiConsoleWorkload, baselineWorkload, handleSummary } from '../common.js';

export const options = buildOptions('smoke', { safety: { requiresWrites: true } });
export function setup() { return setupProfile('smoke'); }
export { apiConsoleWorkload, baselineWorkload, handleSummary };
export default apiConsoleWorkload;
