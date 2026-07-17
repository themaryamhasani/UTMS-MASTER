import { buildOptions, setupProfile, apiConsoleWorkload, handleSummary } from '../common.js';

export const options = buildOptions('stress', { safety: { requiresWrites: true, destructive: true } });
export function setup() { return setupProfile('stress'); }
export { apiConsoleWorkload, handleSummary };
export default apiConsoleWorkload;
