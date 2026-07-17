import { buildOptions, setupProfile, recoveryWorkload, handleSummary } from '../common.js';

export const options = buildOptions('recovery', { safety: { requiresWrites: true } });
export function setup() { return setupProfile('recovery'); }
export { recoveryWorkload, handleSummary };
export default recoveryWorkload;
