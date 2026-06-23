"""
Event Flow Tracer – Brain 2, Component 9

Traces end-to-end flow: UI → API → DB → Event → Consumer → Notification.
Builds a validation checklist for each layer.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass


@dataclass
class FlowStep:
    layer: str
    component: str
    action: str
    data: Optional[str]
    validation_point: str


class EventFlowTracer:
    LAYERS = ["UI", "API", "DB", "Event", "Consumer", "Notification"]

    def trace(
        self,
        feature_name: str,
        apis: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
        db_tables: List[Dict[str, Any]],
        modules: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Build an end-to-end flow trace for a feature."""
        steps: List[Dict[str, Any]] = []
        step_num = 1

        # ── UI Layer ──────────────────────────────────────────────────────────
        steps.append(self._step(
            step_num, "UI",
            component=f"{feature_name} — User Interface",
            action="User fills in the form and submits, or clicks the action button to trigger the operation",
            data="Form input data entered by the user",
            validation_point=(
                "Client-side validation runs before the request is sent — "
                "required fields are filled, formats are correct, and a loading indicator appears. "
                "Input is sanitised to prevent malformed data reaching the server."
            ),
        ))
        step_num += 1

        # ── API Layer ─────────────────────────────────────────────────────────
        if apis:
            for api in apis[:3]:
                method   = api.get("method", "POST")
                endpoint = api.get("endpoint", api.get("name", "API endpoint"))
                steps.append(self._step(
                    step_num, "API",
                    component=f"{method} {endpoint}",
                    action=(
                        f"The server receives the {method} request, verifies the caller's identity, "
                        "and parses the incoming payload"
                    ),
                    data="Validated request body and any query parameters",
                    validation_point=(
                        "The authentication token is present and has not expired. "
                        "The request body matches the expected schema (no missing required fields, correct data types). "
                        "The caller has not exceeded their rate limit. "
                        "Business rules are enforced before any data is written."
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "API",
                component=f"{feature_name} — REST API",
                action="The server receives the HTTP request, verifies authentication, and validates the payload",
                data="Request body and query parameters",
                validation_point=(
                    "Authentication token is present and valid. "
                    "Request payload passes schema validation. "
                    "Rate limit has not been exceeded. "
                    "An idempotency key is checked if the operation can be safely retried."
                ),
            ))
            step_num += 1

        # ── DB Layer ──────────────────────────────────────────────────────────
        if db_tables:
            for tbl in db_tables[:3]:
                steps.append(self._step(
                    step_num, "DB",
                    component=f"Database table: {tbl.get('name', 'storage')}",
                    action="The data is read from or written to the database inside a transaction",
                    data=f"Entity data — schema: {tbl.get('schema_def', 'see DB schema documentation')}",
                    validation_point=(
                        "The record is created or updated correctly with all expected fields. "
                        "Database constraints are enforced — unique values, required fields, and "
                        "foreign key relationships are all respected. "
                        "If an error occurs, the entire transaction is rolled back with no partial writes."
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "DB",
                component="Database — persistence layer",
                action="The operation's data is saved to or retrieved from the database",
                data="The entity being created, updated, or deleted",
                validation_point=(
                    "The record is stored with all required fields populated correctly. "
                    "Uniqueness and referential integrity constraints are respected. "
                    "Any error causes a full rollback, leaving no partial or corrupt data behind."
                ),
            ))
            step_num += 1

        # ── Event Layer ───────────────────────────────────────────────────────
        if events:
            for ev in events[:3]:
                topic = ev.get("topic", ev.get("name", "domain event"))
                steps.append(self._step(
                    step_num, "Event",
                    component=f"Message broker — topic: {topic}",
                    action=(
                        f"After the database write succeeds, the '{topic}' event is published "
                        "to notify downstream services of the change"
                    ),
                    data=f"Event payload — schema: {ev.get('payload_schema', 'see event definition')}",
                    validation_point=(
                        "The event is published exactly once — no duplicates even on retry. "
                        "The payload contains all required fields and matches the agreed schema. "
                        "The correct partition key and message headers are set. "
                        "No event is published if the database transaction was rolled back."
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "Event",
                component="Message broker (Kafka / RabbitMQ / SQS)",
                action=(
                    "After a successful database write, a domain event is published "
                    "to inform other services of the state change"
                ),
                data="Event payload containing the updated entity data and a correlation ID",
                validation_point=(
                    "Event is published only after the database transaction commits (outbox pattern). "
                    "No event is emitted if the transaction fails. "
                    "Failed deliveries are routed to a dead-letter queue for investigation."
                ),
            ))
            step_num += 1

        # ── Consumer Layer ────────────────────────────────────────────────────
        consumer_modules = [
            m for m in modules
            if any(k in m.get("name", "").lower() for k in ("consumer", "subscriber", "worker", "listener"))
        ]
        if consumer_modules:
            for cm in consumer_modules[:2]:
                steps.append(self._step(
                    step_num, "Consumer",
                    component=cm.get("name", "consumer service"),
                    action="The consumer service receives the event and carries out its downstream business logic",
                    data="Consumed event payload",
                    validation_point=(
                        "The event is processed exactly once — duplicate deliveries are safely ignored. "
                        "On processing failure the message is retried; after repeated failures "
                        "it is moved to a dead-letter queue. "
                        "Consumer lag stays within acceptable bounds under normal load."
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "Consumer",
                component="Event consumer / background worker service",
                action="The downstream service receives the event and applies any follow-on business logic",
                data="Consumed event payload",
                validation_point=(
                    "Processing is idempotent — running the same event twice produces the same result. "
                    "Failures trigger retries and ultimately land in a dead-letter queue. "
                    "Message ordering is preserved where the business logic requires it."
                ),
            ))
            step_num += 1

        # ── Notification Layer ────────────────────────────────────────────────
        steps.append(self._step(
            step_num, "Notification",
            component="Notification service (email / push / SMS / webhook)",
            action="The user or an external system is informed of the operation outcome",
            data="Notification message containing the action result",
            validation_point=(
                "The notification is sent to the correct recipient only. "
                "The right template and channel are used for the event type. "
                "No duplicate notifications are sent if the event is retried. "
                "No personal or sensitive data is exposed in the notification body or subject line."
            ),
        ))

        return steps

    def generate_flow_test_cases(self, flow_steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate test cases for each flow step's validation point."""
        test_cases = []
        for step in flow_steps:
            test_cases.append({
                "id": f"FLOW-{step['step']:03d}-{step['layer']}",
                "type": "event_flow",
                "scenario_type": "functional",
                "title": f"{step['layer']} layer — {step['action']}",
                "description": step["validation_point"],
                "component": step["component"],
                "steps": [
                    f"Set up: {step['data'] or 'N/A'}",
                    f"Action: {step['action']}",
                    f"Assert: {step['validation_point']}",
                ],
                "expected_result": step["validation_point"],
                "risk_level": "high" if step["layer"] in ("API", "Event", "DB") else "medium",
            })
        return test_cases

    def generate_failure_path_tests(
        self,
        feature_name: str,
        apis: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Generate async and failure-path test cases not covered by the happy-path flow."""
        tests: List[Dict[str, Any]] = []
        idx = 1

        # ── API timeout / slow response ────────────────────────────────────────
        for api in apis[:3]:
            method = api.get("method", "POST")
            endpoint = api.get("endpoint", api.get("name", "API endpoint"))
            tests.append({
                "id": f"FLOW-FAIL-{idx:03d}",
                "type": "event_flow_failure",
                "scenario_type": "negative",
                "failure_class": "api_timeout",
                "title": f"API timeout: {method} {endpoint} exceeds SLA",
                "description": (
                    f"Simulate {method} {endpoint} taking longer than the SLA threshold "
                    "(e.g. 30 s). Verify the client receives a meaningful timeout error and "
                    "the operation does not partially commit."
                ),
                "steps": [
                    f"Configure {method} {endpoint} to respond after 30 s (mock/stub)",
                    "Trigger the feature flow",
                    "Verify the caller receives HTTP 504 or an explicit timeout error",
                    "Verify no partial data was written to the database",
                    "Verify a retry or circuit-breaker mechanism activates if configured",
                ],
                "expected_result": "Caller gets a safe timeout error; no partial state change; circuit breaker trips after N failures",
                "risk_level": "high",
            })
            idx += 1

        # ── Circuit breaker ────────────────────────────────────────────────────
        if apis:
            endpoint = apis[0].get("endpoint", apis[0].get("name", "primary API"))
            tests.append({
                "id": f"FLOW-FAIL-{idx:03d}",
                "type": "event_flow_failure",
                "scenario_type": "negative",
                "failure_class": "circuit_breaker",
                "title": f"Circuit breaker opens after repeated failures on {endpoint}",
                "description": (
                    "Repeatedly fail the downstream dependency to trigger the circuit breaker. "
                    "Verify open-state fast-fail behaviour and eventual half-open recovery."
                ),
                "steps": [
                    f"Cause {endpoint} to return 500 for 5 consecutive calls",
                    "Verify the circuit breaker moves to OPEN state",
                    "Verify subsequent calls fail fast (< 100 ms) without hitting the dependency",
                    "Wait for the cooldown window, then send one request",
                    "Verify the circuit breaker enters HALF-OPEN and allows the probe request",
                    "Verify recovery to CLOSED state on a successful probe",
                ],
                "expected_result": "Circuit breaker opens, fast-fails, and recovers correctly",
                "risk_level": "high",
            })
            idx += 1

        # ── Event consumer failure → rollback propagation ─────────────────────
        for ev in events[:2]:
            topic = ev.get("topic", ev.get("name", "domain event"))
            tests.append({
                "id": f"FLOW-FAIL-{idx:03d}",
                "type": "event_flow_failure",
                "scenario_type": "negative",
                "failure_class": "consumer_failure_rollback",
                "title": f"Consumer failure on '{topic}' — verify rollback propagation",
                "description": (
                    f"The consumer of '{topic}' throws an exception mid-processing. "
                    "Verify the message is retried, and on repeated failure moved to the "
                    "dead-letter queue without corrupting upstream state."
                ),
                "steps": [
                    f"Publish a valid '{topic}' event",
                    "Configure the consumer to throw an exception on first N attempts",
                    f"Verify the '{topic}' message is retried according to the retry policy",
                    "Exhaust all retries",
                    f"Verify the message lands in the dead-letter queue for '{topic}'",
                    "Verify the upstream DB record reflects the correct 'failed' or 'pending' state",
                    "Verify no duplicate side-effects from the retried consumer calls",
                ],
                "expected_result": f"Dead-letter queue receives the poison message; upstream state is consistent; no duplicate effects",
                "risk_level": "high",
            })
            idx += 1

        # ── Message broker poison pill ─────────────────────────────────────────
        if events:
            topic = events[0].get("topic", events[0].get("name", "domain event"))
            tests.append({
                "id": f"FLOW-FAIL-{idx:03d}",
                "type": "event_flow_failure",
                "scenario_type": "negative",
                "failure_class": "poison_pill",
                "title": f"Poison-pill message on topic '{topic}' does not crash the consumer",
                "description": (
                    f"Inject a malformed or schema-invalid message directly onto the '{topic}' "
                    "broker topic. Verify the consumer handles it gracefully without crashing "
                    "or blocking subsequent messages."
                ),
                "steps": [
                    f"Publish a malformed message to topic '{topic}' (missing required fields, wrong data type)",
                    "Verify the consumer logs a deserialization error",
                    "Verify the consumer does NOT crash or stop processing",
                    "Verify the poison-pill message is moved to the dead-letter queue",
                    "Publish a valid message immediately after",
                    "Verify the valid message is processed normally",
                ],
                "expected_result": "Consumer skips the poison pill, routes it to DLQ, and continues processing",
                "risk_level": "high",
            })
            idx += 1

        # ── DB write failure mid-transaction ─────────────────────────────────
        tests.append({
            "id": f"FLOW-FAIL-{idx:03d}",
            "type": "event_flow_failure",
            "scenario_type": "negative",
            "failure_class": "db_failure_rollback",
            "title": f"{feature_name}: DB failure mid-transaction rolls back cleanly",
            "description": (
                "Simulate a DB constraint violation or connection drop mid-transaction. "
                "Verify the entire operation rolls back and no event is published."
            ),
            "steps": [
                "Begin the feature operation",
                "Inject a DB failure (constraint violation or connection timeout) after the first INSERT",
                "Verify the DB transaction is fully rolled back",
                "Verify NO domain event was published to the message broker",
                "Verify the API returns a 500 with a safe error message (no SQL in response)",
            ],
            "expected_result": "Full rollback; no partial data; no spurious event published; safe error response",
            "risk_level": "high",
        })
        idx += 1

        # ── Idempotency: duplicate request ────────────────────────────────────
        if apis:
            method = apis[0].get("method", "POST")
            endpoint = apis[0].get("endpoint", apis[0].get("name", "API endpoint"))
            tests.append({
                "id": f"FLOW-FAIL-{idx:03d}",
                "type": "event_flow_failure",
                "scenario_type": "negative",
                "failure_class": "idempotency",
                "title": f"Duplicate {method} {endpoint} request is idempotent",
                "description": (
                    f"Send the same {method} {endpoint} request twice with an identical "
                    "idempotency key. Verify the second call returns the same result without "
                    "creating a duplicate record or publishing a second event."
                ),
                "steps": [
                    f"Send {method} {endpoint} with idempotency key 'KEY-001'",
                    "Verify the first call succeeds and creates the resource",
                    f"Send the identical {method} {endpoint} again with the same 'KEY-001' key",
                    "Verify the second call returns the same response (200/201) without a new DB record",
                    "Verify only ONE domain event was published total",
                ],
                "expected_result": "Second call is a no-op; exactly one DB record; exactly one event published",
                "risk_level": "high",
            })

        return tests

    @staticmethod
    def _step(num: int, layer: str, component: str, action: str,
              data: Optional[str], validation_point: str) -> Dict[str, Any]:
        return {
            "step": num,
            "layer": layer,
            "component": component,
            "action": action,
            "data": data,
            "validation_point": validation_point,
        }


event_flow_tracer = EventFlowTracer()
