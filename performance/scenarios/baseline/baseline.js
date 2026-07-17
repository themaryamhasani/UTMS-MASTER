import { buildOptions, setupProfile, baselineWorkload, handleSummary } from '../common.js';

export const options = buildOptions('baseline', { safety: { requiresWrites: false } });
export function setup() { return setupProfile('baseline'); }
export { baselineWorkload, handleSummary };
export default baselineWorkload;
