export function thresholdsFor(config, profile) {
  const normal = {
    http_req_failed: [`rate<${config.errorRate}`],
    business_success_rate: ['rate>0.98'],
    server_error_rate: ['rate<0.01'],
    data_integrity_failure_rate: ['rate==0'],
    dropped_iterations: ['count==0'],
    'http_req_duration{operation:health}': ['p(95)<300'],
    'http_req_duration{operation:api_console_list}': [`p(95)<${config.p95Budget}`],
    'http_req_duration{operation:domain_report}': [`p(95)<${config.p95Budget}`],
  };
  const profiles = {
    smoke: {
      ...normal,
      http_req_failed: ['rate<0.05'],
      business_success_rate: ['rate>0.95'],
      checks: ['rate>0.95'],
    },
    baseline: {
      ...normal,
      http_req_failed: ['rate<0.02'],
      'http_req_duration': [`p(95)<${config.p95Budget}`, `p(99)<${config.p99Budget}`],
    },
    load: normal,
    stress: {
      http_req_failed: ['rate<0.10'],
      business_success_rate: ['rate>0.90'],
      server_error_rate: ['rate<0.10'],
      recovery_failure_rate: ['rate<0.05'],
    },
    spike: {
      http_req_failed: ['rate<0.08'],
      business_success_rate: ['rate>0.92'],
      recovery_failure_rate: ['rate<0.05'],
    },
    soak: normal,
    scalability: {
      http_req_failed: ['rate<0.05'],
      business_success_rate: ['rate>0.95'],
      dropped_iterations: ['count<10'],
    },
    recovery: {
      http_req_failed: ['rate<0.10'],
      business_success_rate: ['rate>0.90'],
      recovery_failure_rate: ['rate<0.05'],
    },
    breakpoint: {
      http_req_failed: ['rate<0.25'],
      business_success_rate: ['rate>0.75'],
      dropped_iterations: ['count<100'],
    },
  };
  return profiles[profile] || normal;
}
