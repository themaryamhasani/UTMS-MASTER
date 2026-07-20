-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'DEVELOPER', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER');

-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('APP', 'SYSTEMS');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TestRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('DRAFT', 'READY', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('FUNCTIONAL', 'INTEGRATION', 'REGRESSION', 'SMOKE', 'UAT', 'SECURITY', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "TestDesignTechnique" AS ENUM ('REQUIREMENTS_BASED', 'EQUIVALENCE_PARTITIONING', 'BOUNDARY_VALUE', 'DECISION_TABLE', 'STATE_TRANSITION', 'SCENARIO', 'CLASSIFICATION_TREE', 'COMBINATORIAL', 'CAUSE_EFFECT', 'SYNTAX', 'RANDOM', 'METAMORPHIC', 'STATEMENT', 'BRANCH', 'DECISION', 'BRANCH_CONDITION', 'BRANCH_CONDITION_COMBINATION', 'MCDC', 'DATA_FLOW', 'ERROR_GUESSING');

-- CreateEnum
CREATE TYPE "QualityAttribute" AS ENUM ('FUNCTIONALITY', 'RELIABILITY', 'USABILITY', 'EFFICIENCY', 'MAINTAINABILITY', 'PORTABILITY', 'SECURITY');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TestRunPurpose" AS ENUM ('SMOKE_TEST', 'FUNCTIONAL_TEST', 'REGRESSION_TEST', 'RETEST', 'UAT', 'INTEGRATION_TEST', 'SECURITY_TEST', 'PERFORMANCE_TEST', 'EXPLORATORY');

-- CreateEnum
CREATE TYPE "RetestTaskStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'RETEST_READY', 'RETEST_PASSED', 'RETEST_FAILED', 'REOPENED', 'CLOSED', 'REJECTED', 'NO_ACTION_NEEDED');

-- CreateEnum
CREATE TYPE "RunIssueType" AS ENUM ('ENVIRONMENT', 'ACCESS', 'DATA', 'DEPENDENCY');

-- CreateEnum
CREATE TYPE "RunIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('SCREENSHOT', 'LOG', 'VIDEO', 'REPORT', 'TRACE', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('UPLOADED', 'VALID', 'INVALID', 'DELETED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('TEST_REQUEST', 'REQUIREMENT', 'FLOW', 'TEST_CASE', 'TEST_RUN', 'BUG', 'RETEST_TASK', 'RUN_ISSUE', 'CHECKLIST', 'VERSION_HISTORY', 'RELEASE_PUBLISH', 'PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

-- CreateEnum
CREATE TYPE "SystemEntityType" AS ENUM ('TEST_REQUEST', 'REQUIREMENT', 'FLOW', 'TEST_CASE', 'TEST_RUN', 'BUG', 'RETEST_TASK', 'RUN_ISSUE', 'CHECKLIST', 'VERSION_HISTORY', 'RELEASE_PUBLISH', 'PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE', 'USER', 'APPLICATION', 'ROLE_ASSIGNMENT', 'API_COLLECTION', 'API_REQUEST', 'API_SHARE_REQUEST', 'API_EXECUTION');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('SECURITY', 'PERFORMANCE', 'PENETRATION');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ChecklistResult" AS ENUM ('PASS', 'FAIL', 'PARTIAL', 'NOT_TESTED');

-- CreateEnum
CREATE TYPE "SecurityReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SecurityReviewItemResult" AS ENUM ('PASS', 'FAIL', 'PARTIAL', 'NOT_TESTED', 'N_A');

-- CreateEnum
CREATE TYPE "PlaywrightRunStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlaywrightQueueStatus" AS ENUM ('QUEUED', 'DISPATCHED', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "PlaywrightProject" AS ENUM ('chromium', 'firefox', 'webkit');

-- CreateEnum
CREATE TYPE "PlaywrightCdeRootKind" AS ENUM ('FRONT', 'DATASERVICE', 'GATEWAY');

-- CreateEnum
CREATE TYPE "PlaywrightTestFileSource" AS ENUM ('DISCOVERED', 'MANAGED');

-- CreateEnum
CREATE TYPE "VersionHistoryStatus" AS ENUM ('DRAFT', 'QA_REVIEW', 'PENDING_DECISION', 'APPROVED', 'CONDITIONAL', 'REJECTED', 'BLOCKED', 'EMERGENCY', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "VersionHistoryDecision" AS ENUM ('APPROVED', 'CONDITIONAL', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "VersionHistoryRequestKind" AS ENUM ('PRIMARY', 'RELATED', 'SNAPSHOT');

-- CreateEnum
CREATE TYPE "QAQualityStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'NOT_READY', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'CANCEL', 'FINALIZE', 'UNLOCK', 'PUBLISH', 'EMERGENCY_PUBLISH', 'ROLE_CHANGE', 'LOGIN', 'LOGOUT', 'CONTEXT_SWITCH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommandSource" AS ENUM ('UI', 'API', 'SYSTEM', 'RUNNER');

-- CreateEnum
CREATE TYPE "CommandTraceStatus" AS ENUM ('COMPLETED', 'REPLAYED');

-- CreateEnum
CREATE TYPE "VersionHistoryWorkflowMode" AS ENUM ('TECH_LEAD_DECISION', 'QA_OWNED_DECISION');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('CDE', 'FAVA');

-- CreateEnum
CREATE TYPE "IntegrationSyncDirection" AS ENUM ('PULL', 'PUSH', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('DISABLED', 'UNKNOWN', 'HEALTHY', 'DEGRADED');

-- CreateEnum
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApiCollectionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApiSharingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'RETURNED', 'APPROVED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ApiRequestSourceType" AS ENUM ('ORIGINAL', 'REFERENCE');

-- CreateEnum
CREATE TYPE "ApiConsumerType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "ApiConsumerStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ApiReferenceStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "ApiExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ApiTransportResult" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApiBusinessResult" AS ENUM ('PASSED', 'FAILED', 'WARNING', 'NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "ApiResponseEvidenceType" AS ENUM ('ACTUAL_EXECUTION', 'IMPORTED_EVIDENCE', 'MANUAL_EXAMPLE');

-- CreateEnum
CREATE TYPE "ApiManualReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApiEnvironmentKind" AS ENUM ('DEVELOPMENT', 'TEST', 'PRE_PRODUCTION', 'PRODUCTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApiNetworkZone" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED', 'TEST');

-- CreateEnum
CREATE TYPE "ApiUsageEventType" AS ENUM ('ADDED_TO_CONSOLE', 'API_OPENED', 'API_EXECUTED', 'REMOVED_FROM_CONSOLE', 'NEW_VERSION_VIEWED');

-- CreateEnum
CREATE TYPE "ApiShareReviewAction" AS ENUM ('APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ScheduledReportStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ReportDeliveryFormat" AS ENUM ('JSON', 'CSV', 'PDF');

-- CreateEnum
CREATE TYPE "ReportAlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "national_code" VARCHAR(32),
    "phone_number" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "context_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "scope" "AccessScope" NOT NULL,
    "application_id" TEXT,
    "scope_application_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_policies" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "version_history_mode" "VersionHistoryWorkflowMode" NOT NULL,
    "qa_review_owner_label" VARCHAR(255) NOT NULL,
    "decision_owner_label" VARCHAR(255) NOT NULL,
    "require_independent_decision_role" BOOLEAN NOT NULL DEFAULT false,
    "capability_roles" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "cde_front_url" TEXT,
    "cde_data_service_url" TEXT,
    "cde_gateway_url" TEXT,
    "workflow_policy_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "scope" "AccessScope" NOT NULL,
    "automated_tests_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignment_applications" (
    "assignment_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignment_applications_pkey" PRIMARY KEY ("assignment_id","application_id")
);

-- CreateTable
CREATE TABLE "test_requests" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "build_number" VARCHAR(64),
    "environment" VARCHAR(120) NOT NULL,
    "priority" "Priority" NOT NULL,
    "risk_level" "Priority" NOT NULL,
    "status" "TestRequestStatus" NOT NULL,
    "system_url" TEXT,
    "test_types" "TestType"[] DEFAULT ARRAY[]::"TestType"[],
    "requester_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "requirement_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_id" TEXT,
    "review_notes" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "version_history_id" TEXT,
    "qa_quality_status" "QAQualityStatus",
    "qa_quality_notes" TEXT,
    "release_decision" "VersionHistoryDecision",
    "release_decision_reason" TEXT,
    "release_decision_by_id" TEXT,
    "release_decision_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_request_requirements" (
    "test_request_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_request_requirements_pkey" PRIMARY KEY ("test_request_id","requirement_id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "acceptance_criteria" TEXT,
    "risk_notes" TEXT,
    "status" "RequirementStatus" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "test_request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "test_request_id" TEXT,
    "requirement_id" TEXT NOT NULL,
    "flow_id" TEXT,
    "title" VARCHAR(500) NOT NULL,
    "scenario" TEXT NOT NULL,
    "preconditions" TEXT NOT NULL,
    "test_data" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "expected_result" TEXT NOT NULL,
    "test_type" "TestType" NOT NULL,
    "test_design_technique" "TestDesignTechnique" NOT NULL,
    "test_design_techniques" "TestDesignTechnique"[] DEFAULT ARRAY[]::"TestDesignTechnique"[],
    "priority" "Priority" NOT NULL,
    "risk_level" "Priority" NOT NULL,
    "quality_attribute" "QualityAttribute" NOT NULL,
    "automation_candidate" BOOLEAN NOT NULL DEFAULT false,
    "regression_candidate" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "readiness_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TestCaseStatus" NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "test_request_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "purposes" "TestRunPurpose"[] DEFAULT ARRAY[]::"TestRunPurpose"[],
    "previous_run_id" TEXT,
    "retest_task_id" TEXT,
    "source_bug_id" TEXT,
    "version" VARCHAR(64) NOT NULL,
    "build_number" VARCHAR(64),
    "version_changed_reason" TEXT,
    "status" "TestRunStatus" NOT NULL,
    "actual_result" TEXT,
    "executed_by_id" TEXT NOT NULL,
    "executed_at" TIMESTAMPTZ(6),
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_version_history_id" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "unlocked_by_id" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlock_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bugs" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "test_run_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "steps_to_reproduce" TEXT NOT NULL,
    "expected_result" TEXT NOT NULL,
    "actual_result" TEXT NOT NULL,
    "severity" "BugSeverity" NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "BugStatus" NOT NULL,
    "previous_status" "BugStatus",
    "previous_status_changed_at" TIMESTAMPTZ(6),
    "assignee_id" TEXT,
    "reported_by_id" TEXT NOT NULL,
    "fixed_version" VARCHAR(64),
    "fix_notes" TEXT,
    "external_tool_link" TEXT,
    "external_tool_id" VARCHAR(255),
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_version_history_id" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "unlocked_by_id" TEXT,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlock_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retest_tasks" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "bug_id" TEXT NOT NULL,
    "source_run_id" TEXT,
    "previous_run_id" TEXT NOT NULL,
    "test_request_id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "purposes" "TestRunPurpose"[] DEFAULT ARRAY[]::"TestRunPurpose"[],
    "status" "RetestTaskStatus" NOT NULL,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "started_by_id" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_run_id" TEXT,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "retest_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retest_task_bugs" (
    "retest_task_id" TEXT NOT NULL,
    "bug_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retest_task_bugs_pkey" PRIMARY KEY ("retest_task_id","bug_id")
);

-- CreateTable
CREATE TABLE "run_issues" (
    "id" TEXT NOT NULL,
    "test_run_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "issue_type" "RunIssueType" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RunIssueStatus" NOT NULL,
    "reported_by_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "resolution" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "run_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "test_request_id" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "status" "ChecklistStatus" NOT NULL,
    "result" "ChecklistResult",
    "notes" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "result" "ChecklistResult",
    "notes" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_checklist_template_items" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "security_checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_reviews" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "test_case_title" VARCHAR(500) NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" "SecurityReviewStatus" NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "security_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_review_items" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "result" "SecurityReviewItemResult",
    "notes" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "security_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playwright_runs" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "test_request_id" TEXT,
    "test_case_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "test_file_path" TEXT NOT NULL,
    "environment" VARCHAR(120) NOT NULL,
    "projects" "PlaywrightProject"[] DEFAULT ARRAY[]::"PlaywrightProject"[],
    "headed" BOOLEAN NOT NULL DEFAULT false,
    "workers" VARCHAR(32),
    "retries" INTEGER,
    "max_failures" VARCHAR(32),
    "trace" VARCHAR(64),
    "reporter" VARCHAR(32),
    "status" "PlaywrightRunStatus" NOT NULL,
    "queue_status" "PlaywrightQueueStatus",
    "runner_id" VARCHAR(255),
    "command" TEXT,
    "working_directory" TEXT,
    "timeout_seconds" INTEGER,
    "artifact_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "artifact_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "report" JSONB,
    "manual_path" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" VARCHAR(255),
    "correlation_id" VARCHAR(255),
    "requested_at" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6),
    "last_heartbeat_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "duration" INTEGER,
    "total_tests" INTEGER,
    "passed_tests" INTEGER,
    "failed_tests" INTEGER,
    "skipped_tests" INTEGER,
    "cancelled_tests" INTEGER,
    "logs" TEXT,
    "triggered_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "playwright_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playwright_test_folders" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "root_kind" "PlaywrightCdeRootKind" NOT NULL,
    "root_url" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "full_path" TEXT NOT NULL,
    "discovered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playwright_test_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playwright_test_files" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "root_kind" "PlaywrightCdeRootKind" NOT NULL,
    "root_url" TEXT NOT NULL,
    "source" "PlaywrightTestFileSource" NOT NULL,
    "folder_path" TEXT NOT NULL,
    "relative_folder_path" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "full_path" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "playwright_test_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playwright_hidden_discovered_paths" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "full_path" TEXT NOT NULL,
    "hidden_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playwright_hidden_discovered_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_histories" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "build_number" VARCHAR(64),
    "status" "VersionHistoryStatus" NOT NULL,
    "primary_test_request_id" TEXT NOT NULL,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "emergency_reason" TEXT,
    "risk_description" TEXT,
    "risk_accepted" BOOLEAN,
    "qa_quality_status" "QAQualityStatus",
    "qa_quality_notes" TEXT,
    "qa_reviewed_by_id" TEXT,
    "qa_reviewed_at" TIMESTAMPTZ(6),
    "decision" "VersionHistoryDecision",
    "decision_reason" TEXT,
    "decision_by_id" TEXT,
    "decision_at" TIMESTAMPTZ(6),
    "snapshot" JSONB,
    "decision_snapshot" JSONB,
    "creation_command" JSONB,
    "last_command" JSONB,
    "created_by_id" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "version_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_history_requests" (
    "version_history_id" TEXT NOT NULL,
    "test_request_id" TEXT NOT NULL,
    "kind" "VersionHistoryRequestKind" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_history_requests_pkey" PRIMARY KEY ("version_history_id","test_request_id","kind")
);

-- CreateTable
CREATE TABLE "version_history_revisions" (
    "id" TEXT NOT NULL,
    "version_history_id" TEXT NOT NULL,
    "qa_quality_status" "QAQualityStatus" NOT NULL,
    "qa_quality_notes" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_history_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "storage_path" TEXT NOT NULL,
    "sha256" VARCHAR(64),
    "status" "AttachmentStatus" NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "entity_type" "SystemEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entity_type" "EntityType",
    "entity_id" TEXT,
    "channels" "NotificationChannel"[] DEFAULT ARRAY[]::"NotificationChannel"[],
    "delivery_status" "NotificationDeliveryStatus",
    "delivered_at" TIMESTAMPTZ(6),
    "correlation_id" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox_items" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_outbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_traces" (
    "id" TEXT NOT NULL,
    "command_name" VARCHAR(255) NOT NULL,
    "entity_type" "SystemEntityType",
    "entity_id" TEXT,
    "application_id" TEXT,
    "user_id" TEXT,
    "idempotency_key" VARCHAR(255),
    "correlation_id" VARCHAR(255) NOT NULL,
    "source" "CommandSource" NOT NULL,
    "status" "CommandTraceStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayed_at" TIMESTAMPTZ(6),

    CONSTRAINT "command_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_idempotency_records" (
    "id" TEXT NOT NULL,
    "command_name" VARCHAR(255) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "payload_hash" VARCHAR(128) NOT NULL,
    "response_payload" JSONB NOT NULL,
    "entity_type" "SystemEntityType",
    "entity_id" TEXT,
    "user_id" TEXT,
    "application_id" TEXT,
    "correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_event_outbox" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "aggregate_type" VARCHAR(255),
    "aggregate_id" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playwright_runner_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_discovery" BOOLEAN NOT NULL DEFAULT true,
    "runner_id" VARCHAR(255) NOT NULL,
    "command_template" TEXT NOT NULL,
    "default_working_directory" TEXT NOT NULL,
    "default_timeout_seconds" INTEGER NOT NULL,
    "artifact_root" TEXT NOT NULL,
    "secret_reference" TEXT,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "playwright_runner_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_adapter_settings" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "base_url" TEXT NOT NULL,
    "credential_reference" TEXT,
    "sync_direction" "IntegrationSyncDirection" NOT NULL,
    "last_health_status" "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_adapter_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_collections" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "workspace_name" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "owner_id" VARCHAR(255) NOT NULL,
    "status" "ApiCollectionStatus" NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_console_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_requests" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "api_id" VARCHAR(255) NOT NULL,
    "semantic_version" VARCHAR(64) NOT NULL,
    "sharing_status" "ApiSharingStatus" NOT NULL,
    "source_type" "ApiRequestSourceType" NOT NULL,
    "reference_id" TEXT,
    "source_request_id" TEXT,
    "share_request_id" TEXT,
    "latest_return_reason" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "method" VARCHAR(16) NOT NULL,
    "url_template" TEXT NOT NULL,
    "query_parameters" JSONB NOT NULL DEFAULT '[]',
    "headers" JSONB NOT NULL DEFAULT '[]',
    "cookies" JSONB NOT NULL DEFAULT '[]',
    "body_type" VARCHAR(64) NOT NULL,
    "body_template" TEXT NOT NULL,
    "authentication" JSONB NOT NULL DEFAULT '{}',
    "tls" JSONB NOT NULL DEFAULT '{}',
    "execution_mode" VARCHAR(64) NOT NULL,
    "classification" JSONB NOT NULL DEFAULT '{}',
    "environment_id" TEXT NOT NULL,
    "assertions" JSONB NOT NULL DEFAULT '[]',
    "scripts" JSONB NOT NULL DEFAULT '{}',
    "documentation" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ApiCollectionStatus" NOT NULL,
    "original_imported_curl" TEXT,
    "imported_curl_id" TEXT,
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_console_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_environment_profiles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "kind" "ApiEnvironmentKind" NOT NULL,
    "base_url" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "default_headers" JSONB NOT NULL DEFAULT '[]',
    "secret_references" JSONB NOT NULL DEFAULT '{}',
    "production_protected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_environment_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_execution_runners" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "network_zone" "ApiNetworkZone" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "api_execution_runners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_request_executions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "runner_id" TEXT NOT NULL,
    "executed_by" VARCHAR(255) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "status" "ApiExecutionStatus" NOT NULL,
    "status_code" INTEGER,
    "response_size" INTEGER,
    "response_content_type" VARCHAR(255),
    "request_snapshot" JSONB NOT NULL,
    "response" JSONB,
    "tls_verification" BOOLEAN NOT NULL,
    "transport_result" "ApiTransportResult" NOT NULL,
    "business_result" "ApiBusinessResult" NOT NULL,
    "assertion_results" JSONB NOT NULL DEFAULT '[]',
    "script_results" JSONB,
    "correlation_id" VARCHAR(255) NOT NULL,
    "error_category" VARCHAR(255),
    "sanitized_error" TEXT,
    "environment_name" VARCHAR(255) NOT NULL,
    "evidence_type" "ApiResponseEvidenceType" NOT NULL,
    "business_justification" TEXT,

    CONSTRAINT "api_request_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_curl_records" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "original_text_reference" TEXT NOT NULL,
    "sanitized_preview" TEXT NOT NULL,
    "detected_dialect" VARCHAR(64) NOT NULL,
    "parser_version" VARCHAR(64) NOT NULL,
    "imported_by" VARCHAR(255) NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "imported_curl_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_manual_response_examples" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '[]',
    "body" TEXT NOT NULL,
    "claimed_environment_id" TEXT NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "reason" TEXT NOT NULL,
    "entered_by" VARCHAR(255) NOT NULL,
    "entered_at" TIMESTAMPTZ(6) NOT NULL,
    "reviewed_by" VARCHAR(255),
    "review_status" "ApiManualReviewStatus" NOT NULL,
    "evidence_attachment_id" TEXT,

    CONSTRAINT "api_manual_response_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_documentation_results" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "generated_by" VARCHAR(255) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "markdown" TEXT NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "word_document_base64" TEXT,
    "word_file_name" VARCHAR(500),
    "word_mime_type" VARCHAR(255),

    CONSTRAINT "api_documentation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_share_requests" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "api_id" VARCHAR(255) NOT NULL,
    "api_title" VARCHAR(500) NOT NULL,
    "application_id" TEXT NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "submitted_by" VARCHAR(255) NOT NULL,
    "submitted_by_name" VARCHAR(255),
    "status" "ApiSharingStatus" NOT NULL,
    "current_revision_number" INTEGER NOT NULL DEFAULT 0,
    "purpose" TEXT,
    "introduction" TEXT,
    "description" TEXT,
    "return_reason" TEXT,
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMPTZ(6),
    "row_version" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_share_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_share_revisions" (
    "id" TEXT NOT NULL,
    "share_request_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submitted_by" VARCHAR(255) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ApiSharingStatus" NOT NULL,
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMPTZ(6),
    "review_action" "ApiShareReviewAction",
    "return_reason" TEXT,
    "documentation_reference" TEXT,
    "row_version" VARCHAR(255) NOT NULL,

    CONSTRAINT "api_share_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_version_consumers" (
    "id" TEXT NOT NULL,
    "api_id" VARCHAR(255) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "consumer_type" "ApiConsumerType" NOT NULL,
    "user_id" VARCHAR(255),
    "role_key" "UserRole",
    "application_id" TEXT NOT NULL,
    "status" "ApiConsumerStatus" NOT NULL,
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_version_consumers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_references" (
    "id" TEXT NOT NULL,
    "api_id" VARCHAR(255) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "source_request_id" TEXT NOT NULL,
    "request_id" TEXT,
    "collection_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApiReferenceStatus" NOT NULL,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_console_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_events" (
    "id" TEXT NOT NULL,
    "event_type" "ApiUsageEventType" NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "user_display_name" VARCHAR(255) NOT NULL,
    "active_role" "UserRole" NOT NULL,
    "application_id" TEXT NOT NULL,
    "api_id" VARCHAR(255) NOT NULL,
    "api_title" VARCHAR(500) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "reference_id" TEXT,
    "event_at" TIMESTAMPTZ(6) NOT NULL,
    "environment_id" TEXT,
    "correlation_id" VARCHAR(255),

    CONSTRAINT "api_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_read_receipts" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "api_id" VARCHAR(255) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_directory_users" (
    "id" TEXT NOT NULL,
    "full_name" VARCHAR(255),
    "email" VARCHAR(320),
    "phone_number" VARCHAR(32),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_console_directory_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_directory_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "application_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "scope" "AccessScope" NOT NULL,
    "application_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_console_directory_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_global_variables" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "current_value" TEXT NOT NULL,
    "initial_value" TEXT,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_console_global_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_notifications" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_console_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_console_audit_logs" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_console_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "application_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "report_key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "cron_expression" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Tehran',
    "formats" "ReportDeliveryFormat"[] DEFAULT ARRAY[]::"ReportDeliveryFormat"[],
    "recipient_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" "ScheduledReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_alerts" (
    "id" TEXT NOT NULL,
    "application_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "report_key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "condition" JSONB NOT NULL,
    "channels" "NotificationChannel"[] DEFAULT ARRAY[]::"NotificationChannel"[],
    "recipient_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ReportAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_evaluated_at" TIMESTAMPTZ(6),
    "last_triggered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_national_code_key" ON "users"("national_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "password_reset_otps_user_id_expires_at_idx" ON "password_reset_otps"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_context_id_idx" ON "user_sessions"("context_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_code_key" ON "applications"("code");

-- CreateIndex
CREATE INDEX "applications_is_active_idx" ON "applications"("is_active");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_role_is_active_idx" ON "user_role_assignments"("user_id", "role", "is_active");

-- CreateIndex
CREATE INDEX "user_role_assignments_application_id_role_idx" ON "user_role_assignments"("application_id", "role");

-- CreateIndex
CREATE INDEX "user_role_assignment_applications_application_id_idx" ON "user_role_assignment_applications"("application_id");

-- CreateIndex
CREATE INDEX "test_requests_application_id_status_idx" ON "test_requests"("application_id", "status");

-- CreateIndex
CREATE INDEX "test_requests_requester_id_idx" ON "test_requests"("requester_id");

-- CreateIndex
CREATE INDEX "test_requests_assignee_id_idx" ON "test_requests"("assignee_id");

-- CreateIndex
CREATE INDEX "test_requests_version_build_number_idx" ON "test_requests"("version", "build_number");

-- CreateIndex
CREATE INDEX "test_request_requirements_requirement_id_idx" ON "test_request_requirements"("requirement_id");

-- CreateIndex
CREATE INDEX "requirements_application_id_status_is_active_idx" ON "requirements"("application_id", "status", "is_active");

-- CreateIndex
CREATE INDEX "requirements_created_by_id_idx" ON "requirements"("created_by_id");

-- CreateIndex
CREATE INDEX "flows_requirement_id_idx" ON "flows"("requirement_id");

-- CreateIndex
CREATE INDEX "test_cases_application_id_status_is_active_idx" ON "test_cases"("application_id", "status", "is_active");

-- CreateIndex
CREATE INDEX "test_cases_requirement_id_idx" ON "test_cases"("requirement_id");

-- CreateIndex
CREATE INDEX "test_cases_test_request_id_idx" ON "test_cases"("test_request_id");

-- CreateIndex
CREATE INDEX "test_runs_application_id_status_idx" ON "test_runs"("application_id", "status");

-- CreateIndex
CREATE INDEX "test_runs_test_request_id_idx" ON "test_runs"("test_request_id");

-- CreateIndex
CREATE INDEX "test_runs_test_case_id_idx" ON "test_runs"("test_case_id");

-- CreateIndex
CREATE INDEX "test_runs_is_locked_idx" ON "test_runs"("is_locked");

-- CreateIndex
CREATE INDEX "bugs_application_id_status_severity_idx" ON "bugs"("application_id", "status", "severity");

-- CreateIndex
CREATE INDEX "bugs_assignee_id_idx" ON "bugs"("assignee_id");

-- CreateIndex
CREATE INDEX "bugs_reported_by_id_idx" ON "bugs"("reported_by_id");

-- CreateIndex
CREATE INDEX "bugs_test_run_id_idx" ON "bugs"("test_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "retest_tasks_created_run_id_key" ON "retest_tasks"("created_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "retest_tasks_idempotency_key_key" ON "retest_tasks"("idempotency_key");

-- CreateIndex
CREATE INDEX "retest_tasks_application_id_status_idx" ON "retest_tasks"("application_id", "status");

-- CreateIndex
CREATE INDEX "retest_tasks_bug_id_idx" ON "retest_tasks"("bug_id");

-- CreateIndex
CREATE INDEX "retest_tasks_assigned_to_id_idx" ON "retest_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "retest_task_bugs_bug_id_idx" ON "retest_task_bugs"("bug_id");

-- CreateIndex
CREATE INDEX "run_issues_application_id_status_idx" ON "run_issues"("application_id", "status");

-- CreateIndex
CREATE INDEX "run_issues_test_run_id_idx" ON "run_issues"("test_run_id");

-- CreateIndex
CREATE INDEX "checklists_application_id_status_type_idx" ON "checklists"("application_id", "status", "type");

-- CreateIndex
CREATE INDEX "checklists_test_request_id_idx" ON "checklists"("test_request_id");

-- CreateIndex
CREATE INDEX "checklist_items_checklist_id_order_idx" ON "checklist_items"("checklist_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "security_checklist_template_items_order_key" ON "security_checklist_template_items"("order");

-- CreateIndex
CREATE INDEX "security_reviews_application_id_status_idx" ON "security_reviews"("application_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "security_reviews_test_case_id_key" ON "security_reviews"("test_case_id");

-- CreateIndex
CREATE INDEX "security_review_items_review_id_order_idx" ON "security_review_items"("review_id", "order");

-- CreateIndex
CREATE INDEX "playwright_runs_application_id_status_idx" ON "playwright_runs"("application_id", "status");

-- CreateIndex
CREATE INDEX "playwright_runs_test_request_id_idx" ON "playwright_runs"("test_request_id");

-- CreateIndex
CREATE INDEX "playwright_runs_correlation_id_idx" ON "playwright_runs"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "playwright_test_folders_application_id_full_path_key" ON "playwright_test_folders"("application_id", "full_path");

-- CreateIndex
CREATE INDEX "playwright_test_files_application_id_source_idx" ON "playwright_test_files"("application_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "playwright_test_files_application_id_full_path_key" ON "playwright_test_files"("application_id", "full_path");

-- CreateIndex
CREATE UNIQUE INDEX "playwright_hidden_discovered_paths_application_id_full_path_key" ON "playwright_hidden_discovered_paths"("application_id", "full_path");

-- CreateIndex
CREATE INDEX "version_histories_application_id_status_idx" ON "version_histories"("application_id", "status");

-- CreateIndex
CREATE INDEX "version_histories_primary_test_request_id_idx" ON "version_histories"("primary_test_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "version_histories_application_id_version_build_number_key" ON "version_histories"("application_id", "version", "build_number");

-- CreateIndex
CREATE INDEX "version_history_requests_test_request_id_idx" ON "version_history_requests"("test_request_id");

-- CreateIndex
CREATE INDEX "version_history_revisions_version_history_id_created_at_idx" ON "version_history_revisions"("version_history_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "audit_logs_application_id_created_at_idx" ON "audit_logs"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_entity_type_entity_id_idx" ON "comments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_correlation_id_idx" ON "notifications"("correlation_id");

-- CreateIndex
CREATE INDEX "notification_outbox_items_status_created_at_idx" ON "notification_outbox_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_outbox_items_user_id_idx" ON "notification_outbox_items"("user_id");

-- CreateIndex
CREATE INDEX "notification_outbox_items_correlation_id_idx" ON "notification_outbox_items"("correlation_id");

-- CreateIndex
CREATE INDEX "command_traces_application_id_created_at_idx" ON "command_traces"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "command_traces_correlation_id_idx" ON "command_traces"("correlation_id");

-- CreateIndex
CREATE INDEX "command_traces_idempotency_key_idx" ON "command_traces"("idempotency_key");

-- CreateIndex
CREATE INDEX "command_idempotency_records_correlation_id_idx" ON "command_idempotency_records"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "command_idempotency_records_command_name_idempotency_key_key" ON "command_idempotency_records"("command_name", "idempotency_key");

-- CreateIndex
CREATE INDEX "domain_event_outbox_status_occurred_at_idx" ON "domain_event_outbox"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_event_outbox_aggregate_type_aggregate_id_idx" ON "domain_event_outbox"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_adapter_settings_provider_key" ON "integration_adapter_settings"("provider");

-- CreateIndex
CREATE INDEX "api_console_collections_application_id_owner_id_status_idx" ON "api_console_collections"("application_id", "owner_id", "status");

-- CreateIndex
CREATE INDEX "api_console_requests_application_id_status_idx" ON "api_console_requests"("application_id", "status");

-- CreateIndex
CREATE INDEX "api_console_requests_collection_id_idx" ON "api_console_requests"("collection_id");

-- CreateIndex
CREATE INDEX "api_console_requests_api_id_semantic_version_idx" ON "api_console_requests"("api_id", "semantic_version");

-- CreateIndex
CREATE INDEX "api_request_executions_request_id_started_at_idx" ON "api_request_executions"("request_id", "started_at");

-- CreateIndex
CREATE INDEX "api_request_executions_correlation_id_idx" ON "api_request_executions"("correlation_id");

-- CreateIndex
CREATE INDEX "imported_curl_records_request_id_idx" ON "imported_curl_records"("request_id");

-- CreateIndex
CREATE INDEX "api_manual_response_examples_request_id_idx" ON "api_manual_response_examples"("request_id");

-- CreateIndex
CREATE INDEX "api_documentation_results_request_id_generated_at_idx" ON "api_documentation_results"("request_id", "generated_at");

-- CreateIndex
CREATE INDEX "api_share_requests_application_id_status_idx" ON "api_share_requests"("application_id", "status");

-- CreateIndex
CREATE INDEX "api_share_requests_api_id_version_idx" ON "api_share_requests"("api_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "api_share_revisions_share_request_id_revision_number_key" ON "api_share_revisions"("share_request_id", "revision_number");

-- CreateIndex
CREATE INDEX "api_version_consumers_api_id_version_status_idx" ON "api_version_consumers"("api_id", "version", "status");

-- CreateIndex
CREATE INDEX "api_version_consumers_application_id_idx" ON "api_version_consumers"("application_id");

-- CreateIndex
CREATE INDEX "api_console_references_api_id_version_status_idx" ON "api_console_references"("api_id", "version", "status");

-- CreateIndex
CREATE INDEX "api_console_references_application_id_idx" ON "api_console_references"("application_id");

-- CreateIndex
CREATE INDEX "api_usage_events_application_id_event_at_idx" ON "api_usage_events"("application_id", "event_at");

-- CreateIndex
CREATE INDEX "api_usage_events_api_id_version_idx" ON "api_usage_events"("api_id", "version");

-- CreateIndex
CREATE INDEX "api_usage_events_user_id_idx" ON "api_usage_events"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_read_receipts_user_id_api_id_version_key" ON "api_read_receipts"("user_id", "api_id", "version");

-- CreateIndex
CREATE INDEX "api_console_directory_role_assignments_user_id_role_idx" ON "api_console_directory_role_assignments"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "api_console_global_variables_key_key" ON "api_console_global_variables"("key");

-- CreateIndex
CREATE INDEX "api_console_notifications_user_id_is_read_created_at_idx" ON "api_console_notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "api_console_audit_logs_action_created_at_idx" ON "api_console_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "api_console_audit_logs_user_id_created_at_idx" ON "api_console_audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_status_next_run_at_idx" ON "scheduled_reports"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_application_id_idx" ON "scheduled_reports"("application_id");

-- CreateIndex
CREATE INDEX "report_alerts_status_last_evaluated_at_idx" ON "report_alerts"("status", "last_evaluated_at");

-- CreateIndex
CREATE INDEX "report_alerts_application_id_idx" ON "report_alerts"("application_id");

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "user_role_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_workflow_policy_id_fkey" FOREIGN KEY ("workflow_policy_id") REFERENCES "workflow_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignment_applications" ADD CONSTRAINT "user_role_assignment_applications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "user_role_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignment_applications" ADD CONSTRAINT "user_role_assignment_applications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_version_history_id_fkey" FOREIGN KEY ("version_history_id") REFERENCES "version_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_release_decision_by_id_fkey" FOREIGN KEY ("release_decision_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_request_requirements" ADD CONSTRAINT "test_request_requirements_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_request_requirements" ADD CONSTRAINT "test_request_requirements_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_previous_run_id_fkey" FOREIGN KEY ("previous_run_id") REFERENCES "test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_retest_task_id_fkey" FOREIGN KEY ("retest_task_id") REFERENCES "retest_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_source_bug_id_fkey" FOREIGN KEY ("source_bug_id") REFERENCES "bugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_executed_by_id_fkey" FOREIGN KEY ("executed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_locked_by_version_history_id_fkey" FOREIGN KEY ("locked_by_version_history_id") REFERENCES "version_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_unlocked_by_id_fkey" FOREIGN KEY ("unlocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_locked_by_version_history_id_fkey" FOREIGN KEY ("locked_by_version_history_id") REFERENCES "version_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_unlocked_by_id_fkey" FOREIGN KEY ("unlocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_previous_run_id_fkey" FOREIGN KEY ("previous_run_id") REFERENCES "test_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_tasks" ADD CONSTRAINT "retest_tasks_created_run_id_fkey" FOREIGN KEY ("created_run_id") REFERENCES "test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_task_bugs" ADD CONSTRAINT "retest_task_bugs_retest_task_id_fkey" FOREIGN KEY ("retest_task_id") REFERENCES "retest_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retest_task_bugs" ADD CONSTRAINT "retest_task_bugs_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_issues" ADD CONSTRAINT "run_issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_reviews" ADD CONSTRAINT "security_reviews_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_reviews" ADD CONSTRAINT "security_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_reviews" ADD CONSTRAINT "security_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_review_items" ADD CONSTRAINT "security_review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "security_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_runs" ADD CONSTRAINT "playwright_runs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_runs" ADD CONSTRAINT "playwright_runs_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_runs" ADD CONSTRAINT "playwright_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_test_folders" ADD CONSTRAINT "playwright_test_folders_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_test_files" ADD CONSTRAINT "playwright_test_files_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_test_files" ADD CONSTRAINT "playwright_test_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_hidden_discovered_paths" ADD CONSTRAINT "playwright_hidden_discovered_paths_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_histories" ADD CONSTRAINT "version_histories_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_histories" ADD CONSTRAINT "version_histories_primary_test_request_id_fkey" FOREIGN KEY ("primary_test_request_id") REFERENCES "test_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_histories" ADD CONSTRAINT "version_histories_qa_reviewed_by_id_fkey" FOREIGN KEY ("qa_reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_histories" ADD CONSTRAINT "version_histories_decision_by_id_fkey" FOREIGN KEY ("decision_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_histories" ADD CONSTRAINT "version_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_history_requests" ADD CONSTRAINT "version_history_requests_version_history_id_fkey" FOREIGN KEY ("version_history_id") REFERENCES "version_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_history_requests" ADD CONSTRAINT "version_history_requests_test_request_id_fkey" FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_history_revisions" ADD CONSTRAINT "version_history_revisions_version_history_id_fkey" FOREIGN KEY ("version_history_id") REFERENCES "version_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_history_revisions" ADD CONSTRAINT "version_history_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox_items" ADD CONSTRAINT "notification_outbox_items_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox_items" ADD CONSTRAINT "notification_outbox_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_traces" ADD CONSTRAINT "command_traces_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_traces" ADD CONSTRAINT "command_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playwright_runner_settings" ADD CONSTRAINT "playwright_runner_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_collections" ADD CONSTRAINT "api_console_collections_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_requests" ADD CONSTRAINT "api_console_requests_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "api_console_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_requests" ADD CONSTRAINT "api_console_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_requests" ADD CONSTRAINT "api_console_requests_source_request_id_fkey" FOREIGN KEY ("source_request_id") REFERENCES "api_console_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_requests" ADD CONSTRAINT "api_console_requests_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "api_environment_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_executions" ADD CONSTRAINT "api_request_executions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "api_console_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_executions" ADD CONSTRAINT "api_request_executions_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "api_environment_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_executions" ADD CONSTRAINT "api_request_executions_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "api_execution_runners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_curl_records" ADD CONSTRAINT "imported_curl_records_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "api_console_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_manual_response_examples" ADD CONSTRAINT "api_manual_response_examples_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "api_console_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_documentation_results" ADD CONSTRAINT "api_documentation_results_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "api_console_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_share_requests" ADD CONSTRAINT "api_share_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "api_console_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_share_requests" ADD CONSTRAINT "api_share_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_share_revisions" ADD CONSTRAINT "api_share_revisions_share_request_id_fkey" FOREIGN KEY ("share_request_id") REFERENCES "api_share_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_version_consumers" ADD CONSTRAINT "api_version_consumers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_references" ADD CONSTRAINT "api_console_references_source_request_id_fkey" FOREIGN KEY ("source_request_id") REFERENCES "api_console_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_references" ADD CONSTRAINT "api_console_references_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "api_console_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_console_references" ADD CONSTRAINT "api_console_references_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_events" ADD CONSTRAINT "api_usage_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_alerts" ADD CONSTRAINT "report_alerts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_alerts" ADD CONSTRAINT "report_alerts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
