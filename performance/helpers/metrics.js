import { Counter, Rate, Trend } from 'k6/metrics';

export const auth_duration = new Trend('auth_duration');
export const dashboard_duration = new Trend('dashboard_duration');
export const api_console_execute_duration = new Trend('api_console_execute_duration');
export const report_generation_duration = new Trend('report_generation_duration');
export const entity_create_duration = new Trend('entity_create_duration');
export const entity_update_duration = new Trend('entity_update_duration');
export const download_duration = new Trend('download_duration');
export const dependency_response_duration = new Trend('dependency_response_duration');
export const recovery_duration = new Trend('recovery_duration');

export const business_success_rate = new Rate('business_success_rate');
export const authentication_failure_rate = new Rate('authentication_failure_rate');
export const authorization_failure_rate = new Rate('authorization_failure_rate');
export const validation_failure_rate = new Rate('validation_failure_rate');
export const server_error_rate = new Rate('server_error_rate');
export const data_integrity_failure_rate = new Rate('data_integrity_failure_rate');
export const timeout_rate = new Rate('timeout_rate');
export const recovery_failure_rate = new Rate('recovery_failure_rate');

export const entities_created = new Counter('entities_created');
export const reports_generated = new Counter('reports_generated');
export const files_downloaded = new Counter('files_downloaded');
export const execution_requests = new Counter('execution_requests');
export const retries_observed = new Counter('retries_observed');
export const duplicate_operations = new Counter('duplicate_operations');
export const dropped_business_transactions = new Counter('dropped_business_transactions');
