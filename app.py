"""
AI Revenue Recovery Agent - FastAPI backend

Run with:
    pip install fastapi uvicorn --break-system-packages
    uvicorn app:app --reload --port 8000

Then open http://localhost:8000 in a browser.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from engine import LLMDecisionPolicy, RevenueRecoveryEngine, generate_event

app = FastAPI(title="AI Revenue Recovery Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def new_engine():
    # Uses Claude when configured; LLMDecisionPolicy safely falls back to rules otherwise.
    return RevenueRecoveryEngine(decision_policy=LLMDecisionPolicy())


engine = new_engine()


class SimulationEvent(BaseModel):
    amount: float
    bank: str
    method: str
    status: str
    error_code: Optional[str] = None
    customer_id: str = "acceptance_test"


@app.get("/")
def root():
    return FileResponse("static/dashboard.html")


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.post("/simulate/batch")
def simulate_batch(n: int = 30, inject_degradation: bool = False):
    """
    Generates n synthetic payment events and runs them through the full
    detect -> diagnose -> decide -> execute pipeline.
    If inject_degradation=True, a burst of correlated HDFC/UPI gateway
    timeouts is included to demonstrate systemic-issue detection.
    """
    degradation_burst = max(15, n // 2) if inject_degradation else 0

    for i in range(n):
        force = inject_degradation and i < degradation_burst
        event = generate_event(force_degradation=force)
        engine.ingest_event(event)

    return {"status": "ok", "events_generated": n}


@app.post("/simulate/recovery")
def simulate_recovery(n: int = 55):
    """Generate healthy HDFC/UPI traffic to visibly demonstrate auto-resume."""
    for _ in range(n):
        engine.ingest_event(generate_event(force_recovery=True))
    return {"status": "ok", "events_generated": n}


@app.post("/simulate/event")
def simulate_event(payload: SimulationEvent):
    """Ingest one controlled synthetic event for repeatable demos and acceptance tests."""
    from engine import PaymentEvent
    event = PaymentEvent(
        id=f"sim-{len(engine.events) + 1}", timestamp=__import__("time").time(),
        amount=payload.amount, bank=payload.bank, method=payload.method,
        status=payload.status, error_code=payload.error_code, customer_id=payload.customer_id,
    )
    engine.ingest_event(event)
    return {"status": "ok", "event_id": event.id}


@app.get("/metrics")
def metrics():
    return engine.get_metrics()


@app.get("/degradations")
def degradations():
    return [d.__dict__ for d in engine.degradations[-20:]]


@app.get("/actions")
def actions():
    return [a.__dict__ for a in engine.actions[-50:]]


@app.get("/pending-review")
def pending_review():
    return [a.__dict__ for a in engine.actions if a.outcome == "pending_human_review"][-50:]


@app.get("/customer-messages")
def customer_messages():
    return [a.__dict__ for a in engine.actions if a.customer_message][-50:]


@app.get("/narration")
def narration():
    return {"segments_monitored": len(engine.segment_window), "items": engine.narration_feed[-50:]}


@app.get("/audit-log")
def audit_log():
    return engine.audit_log[-100:]


@app.post("/reset")
def reset():
    global engine
    engine = new_engine()
    return {"status": "reset"}
