# API Modules

API modules are bounded contexts for backend behavior. Each module owns its domain rules, application commands and queries, infrastructure adapters, and presentation endpoints.

What belongs here:

- Domain entities, policies, value objects, events, and repository contracts.
- Application command/query handlers and DTOs.
- Infrastructure implementations for persistence, queueing, external services, and transitional adapters.
- Thin presentation adapters such as HTTP controllers.

What does not belong here:

- Frontend code.
- Worker or Playwright runner implementation.
- Shared test fixtures.
- Runtime data files.

Dependency direction is presentation to application to domain. Infrastructure may implement domain or application ports, but domain code must not import framework, persistence, queue, filesystem, or environment-specific modules.
