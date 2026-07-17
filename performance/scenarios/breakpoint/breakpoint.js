import { buildOptions, setupProfile, apiConsoleWorkload, handleSummary } from '../common.js';

export const options = buildOptions('breakpoint', { safety: { requiresWrites: true, destructive: true } });
export function setup() { return setupProfile('breakpoint'); }
export { apiConsoleWorkload, handleSummary };
export default apiConsoleWorkload;
