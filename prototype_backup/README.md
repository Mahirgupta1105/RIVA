# Recovery Pulse / RIVA

RIVA (Revenue Intelligence & Recovery Agent) is the agent behind Recovery Pulse. It detects payment-health degradation, makes bounded recovery recommendations, escalates uncertainty to a human, and narrates material events live.

## Run

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="..." # optional; RIVA safely uses rules if omitted
uvicorn app:app --reload --port 8000
```

Open `http://localhost:8000`. Use the degradation button followed by **Simulate HDFC + UPI recovery** to demonstrate automatic recovery and RIVA's narration.

## Decision safety

`LLMDecisionPolicy` calls Claude with a constrained JSON schema and only permits the existing bounded action set. Missing credentials, timeouts, malformed JSON, and invalid actions automatically use `RuleBasedPolicy`; each decision exposes `policy_source` for auditability. Decisions below 0.5 confidence become `pending_human_review` and are never auto-executed.

## Production scale-out

Move the in-memory `events`, `actions`, `degradations`, and `audit_log` collections to Postgres, keyed by `merchant_id`. Store retry counts, paused segments, active degradations, and healthy streaks in Redis with TTLs. Include `merchant_id` in every segment key and database index so merchant baselines and outcomes cannot mix. Run stateless API workers against those shared stores and stream narration over SSE/WebSockets instead of polling.
