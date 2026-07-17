import { buildOptions, setupProfile, apiConsoleWorkload, handleSummary } from '../common.js';

export const options = buildOptions('spike', { safety: { requiresWrites: true } });
export function setup() { return setupProfile('spike'); }
export { apiConsoleWorkload, handleSummary };
export default apiConsoleWorkload;
