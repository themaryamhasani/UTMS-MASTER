import { buildOptions, setupProfile, apiConsoleWorkload, handleSummary } from '../common.js';

export const options = buildOptions('scalability', { safety: { requiresWrites: true } });
export function setup() { return setupProfile('scalability'); }
export { apiConsoleWorkload, handleSummary };
export default apiConsoleWorkload;
