import { buildOptions, setupProfile, apiConsoleWorkload, handleSummary } from '../common.js';

export const options = buildOptions('load', { safety: { requiresWrites: true } });
export function setup() { return setupProfile('load'); }
export { apiConsoleWorkload, handleSummary };
export default apiConsoleWorkload;
