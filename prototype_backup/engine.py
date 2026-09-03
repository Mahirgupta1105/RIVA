"""
AI Revenue Recovery Agent - Core Engine (v2)

Pipeline: Detect -> Diagnose -> Decide -> Execute -> Log

CHANGES FROM v1 (fixes for known weaknesses — see comments tagged FIX:)
  - FIX(unpause-bug):      segments that were paused for a systemic issue now
                            automatically re-check and unpause once failure
                            rates recover, instead of staying paused forever.
  - FIX(adaptive-baseline): per-segment baseline is now an exponential moving
                            average learned from observed traffic, not a
                            hardcoded constant — reduces false positives from
                            naturally noisy/low-volume segments.
  - FIX(cost-awareness):    the decision step now weighs the expected value of
                            an action (probability of recovery * amount) against
                            an estimated action cost before choosing to act,
                            instead of always acting the same way regardless of
                            transaction size.
  - FIX(pluggable-decision): the rule-based policy is now the default fallback
                            behind a `DecisionPolicy` interface. A real LLM-backed
                            policy (e.g. Claude) can be swapped in without
                            touching the bounded-execution safety wrapper.
  - FIX(learning-loop):     the engine tracks per-cause success rates from
                            actual outcomes and feeds them back into future
                            expected-value calculations (a simple online
                            learning loop instead of static assumptions).
  - FIX(real-metrics):      time-to-detection and false-positive rate are now
                            actually computed, not just listed as aspirational
                            metrics in documentation.

This is still a self-contained simulation engine. In a real deployment,
`ingest_event` would be called from a Razorpay payment webhook instead of
the synthetic generator, and state would live in Postgres/Redis rather
than in-memory (see NOTES-FOR-CODEX.md for the scale-out plan).
"""

import random
import time
import uuid
import json
import os
import urllib.error
import urllib.request
from abc import ABC, abstractmethod
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

# ---------------------------------------------------------------------------
# Config / constants
# ---------------------------------------------------------------------------

BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "Yes Bank"]
METHODS = ["UPI", "Card", "Netbanking", "Wallet"]

ERROR_CODE_TO_CAUSE = {
    "INSUFFICIENT_FUNDS": "insufficient_funds",
    "CARD_EXPIRED": "expired_card",
    "ISSUER_DECLINED": "issuer_decline",
    "GATEWAY_TIMEOUT": "gateway_timeout",
    "OTP_FAILED": "otp_failure",
    "BANK_SERVER_DOWN": "bank_outage",
    "RISK_BLOCKED": "risk_block",
}

SYSTEMIC_CAUSES = {"bank_outage", "gateway_timeout"}

MAX_RETRIES_PER_TXN = 3

# Estimated operational cost per action type (₹) — sending an SMS/WhatsApp
# message or attempting a gateway retry is not free. Used for expected-value
# gating so tiny transactions don't trigger disproportionately expensive
# recovery attempts.
ACTION_COST = {
    # Include gateway/message fees plus operational handling, rather than only
    # the transport fee. This keeps low-value payments from consuming recovery
    # capacity when their expected recovery cannot cover the intervention.
    "smart_retry": 6.0,
    "nudge_alt_method": 4.0,
    "send_comms": 4.0,
    "escalate": 15.0,         # human/ops time is the most expensive action
    "closed": 0.0,
}

# Prior success-rate assumptions used ONLY until the engine has observed
# enough real outcomes per cause to trust its own learned rates.
PRIOR_SUCCESS_RATE = {
    "smart_retry": 0.55,
    "nudge_alt_method": 0.35,
    "send_comms": 0.35,
    "escalate": 0.0,   # escalation doesn't "recover" money itself, it unblocks a human decision
    "closed": 0.0,
}

# FIX(self-referential-learning-bug): the simulator's GROUND TRUTH success
# probability per action, kept separate from PRIOR_SUCCESS_RATE / the engine's
# learned belief. Earlier versions drew simulated outcomes using the engine's
# own current *belief*, which created a self-reinforcing feedback loop (a few
# early unlucky draws would drag the belief down, which then made subsequent
# draws less likely to succeed, collapsing the learned rate toward zero
# regardless of the "true" underlying rate). Simulated outcomes must be drawn
# from a fixed ground truth so the learning loop can be judged on whether it
# actually converges toward the truth, not on its own prior guesses.
TRUE_SUCCESS_RATE = {
    "smart_retry": 0.55,
    "nudge_alt_method": 0.35,
    "send_comms": 0.35,
}

MIN_OBSERVATIONS_BEFORE_TRUSTING_LEARNED_RATE = 8
LEARNED_RATE_MAX_WILSON_WIDTH = 0.55
HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.5
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "4"))
VALID_ACTION_TYPES = {"smart_retry", "nudge_alt_method", "send_comms", "escalate", "closed"}

# Adaptive baseline tuning
# FIX(baseline-timescale): the baseline is now computed from a much LARGER,
# separate rolling window than the short window used for anomaly detection.
# Using the same timescale for both (as in the earlier version) let the
# baseline drift toward the anomaly before the threshold could ever fire.
BASELINE_WINDOW_SIZE = 200          # long window used only for the "normal" baseline
BASELINE_MIN_SAMPLES = 20           # below this, fall back to the default baseline
DEFAULT_BASELINE_FAILURE_RATE = 0.08  # used until a segment has enough history of its own
DEGRADATION_THRESHOLD = 0.35       # failure rate above baseline to trigger a flag
MIN_SAMPLES_BEFORE_DETECTION = 15  # short window sample size used to compute current failure rate
RECOVERY_CONFIRMATION_SAMPLES = 10  # consecutive healthy samples needed to unpause a segment
RECOVERY_FAILURE_RATE_MARGIN = 0.10  # must be within this margin of baseline to count as "healthy"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class PaymentEvent:
    id: str
    timestamp: float
    amount: float
    bank: str
    method: str
    status: str               # "success" | "failed"
    error_code: Optional[str] = None
    customer_id: str = ""


@dataclass
class DegradationEvent:
    id: str
    timestamp: float
    segment_key: str
    failure_rate: float
    baseline_at_detection: float
    cause: str
    systemic: bool
    explanation: str = ""
    resolved_at: Optional[float] = None
    was_false_positive: Optional[bool] = None  # set later once we know how it played out


@dataclass
class RecoveryAction:
    id: str
    timestamp: float
    txn_id: str
    cause: str
    action_type: str
    explanation: str
    outcome: Optional[str] = None       # "recovered" | "failed" | "pending" | "skipped"
    amount: float = 0.0
    expected_value: float = 0.0
    confidence: float = 0.0
    policy_source: str = "rule_based"
    customer_message: Optional[str] = None
    communication_language: Optional[str] = None


# ---------------------------------------------------------------------------
# Pluggable decision policy
# ---------------------------------------------------------------------------

class DecisionPolicy(ABC):
    """
    Interface for the recovery decision step. Swap RuleBasedPolicy for an
    LLM-backed policy (e.g. wrapping a Claude API call) without touching any
    of the bounded-execution / safety logic in the engine — that stays as a
    wrapper around whatever policy is plugged in here.
    """

    @abstractmethod
    def decide(self, cause: str, attempts_so_far: int, segment_paused: bool,
               amount: float, success_rates: dict) -> tuple[str, str, float]:
        """
        Returns (action_type, explanation, confidence[0-1]).
        `success_rates` maps action_type -> observed or prior success rate,
        so the policy (rule-based or LLM) can factor in what's actually
        been working.
        """
        raise NotImplementedError


class RuleBasedPolicy(DecisionPolicy):
    """
    Deterministic fallback policy. This is intentionally simple and
    auditable — it is NOT the final production decision-maker. A real
    deployment should replace this with an LLM call (see
    NOTES-FOR-CODEX.md, section "Wiring in a real LLM"), keeping this class
    around as a safe default/fallback if the LLM call fails or times out.
    """

    def decide(self, cause: str, attempts_so_far: int, segment_paused: bool,
               amount: float, success_rates: dict) -> tuple[str, str, float]:

        if attempts_so_far >= MAX_RETRIES_PER_TXN:
            return "closed", (
                f"Max retry attempts ({MAX_RETRIES_PER_TXN}) reached for cause '{cause}'. "
                f"Stopping rule triggered — closing case."
            ), 1.0

        if segment_paused or cause in SYSTEMIC_CAUSES:
            return "escalate", (
                f"Cause '{cause}' indicates a systemic bank/gateway-side issue. "
                f"Retrying would not help. Escalating to ops instead."
            ), 0.9

        if cause == "expired_card":
            return "nudge_alt_method", (
                "Card has expired — retrying the same card will always fail. "
                "Nudging customer to update card details or pay via UPI instead."
            ), 0.8

        if cause == "risk_block":
            return "escalate", (
                "Transaction was blocked by risk rules. Requires manual review."
            ), 0.9

        if cause == "insufficient_funds":
            return "smart_retry", (
                "Insufficient funds — scheduling smart retry at a statistically "
                "better time window rather than immediate blind retry."
            ), 0.6

        if cause == "otp_failure":
            return "send_comms", (
                "OTP failure is usually a one-off UX issue. Sending a payment "
                "link so the customer can complete payment on their own time."
            ), 0.6

        if cause == "issuer_decline":
            return "smart_retry", (
                "Generic issuer decline — attempting a bounded smart retry "
                "after a cooldown, since a fraction of these are transient."
            ), 0.5

        return "send_comms", "Unrecognized cause — defaulting to a customer nudge.", 0.3


class LLMDecisionPolicy(DecisionPolicy):
    """Claude-backed policy with a bounded, auditable rule-based fallback."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None,
                 timeout_seconds: float = LLM_TIMEOUT_SECONDS, opener=None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model or os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
        self.timeout_seconds = timeout_seconds
        self.fallback = RuleBasedPolicy()
        self.opener = opener or urllib.request.urlopen
        self.last_decision_source = "rule_based_fallback"
        self.last_fallback_reason: Optional[str] = None

    def decide(self, cause: str, attempts_so_far: int, segment_paused: bool,
               amount: float, success_rates: dict) -> tuple[str, str, float]:
        if not self.api_key:
            return self._fallback("ANTHROPIC_API_KEY is not configured", cause, attempts_so_far,
                                  segment_paused, amount, success_rates)
        prompt = {
            "task": "Choose exactly one safe payment-recovery action.",
            "valid_action_types": sorted(VALID_ACTION_TYPES),
            "transaction": {"cause": cause, "amount_inr": amount,
                            "attempts_so_far": attempts_so_far,
                            "segment_paused": segment_paused},
            "learned_success_rates": success_rates,
            "constraints": ["Never invent an action outside valid_action_types.",
                            "Use escalate for systemic or risk issues.",
                            "Return JSON only: action_type, explanation, confidence (0 to 1)."],
        }
        body = json.dumps({"model": self.model, "max_tokens": 220,
                           "messages": [{"role": "user", "content": json.dumps(prompt)}]}).encode()
        request = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
            headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"}, method="POST")
        try:
            with self.opener(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode())
            text = "".join(block.get("text", "") for block in payload.get("content", [])
                           if block.get("type") == "text")
            parsed = json.loads(text.removeprefix("```json").removesuffix("```").strip())
            action = parsed.get("action_type")
            confidence = float(parsed.get("confidence"))
            explanation = str(parsed.get("explanation", "")).strip()
            if action not in VALID_ACTION_TYPES or not explanation or not 0 <= confidence <= 1:
                raise ValueError("invalid structured LLM decision")
            self.last_decision_source, self.last_fallback_reason = "llm", None
            return action, explanation, confidence
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
            return self._fallback(str(exc), cause, attempts_so_far, segment_paused, amount, success_rates)

    def _fallback(self, reason, cause, attempts, paused, amount, success_rates):
        self.last_decision_source, self.last_fallback_reason = "rule_based_fallback", reason
        action, explanation, confidence = self.fallback.decide(cause, attempts, paused, amount, success_rates)
        return action, f"{explanation} [LLM fallback: {reason}]", confidence


# ---------------------------------------------------------------------------
# Core engine
# ---------------------------------------------------------------------------

class RevenueRecoveryEngine:
    def __init__(self, decision_policy: Optional[DecisionPolicy] = None):
        self.events: list[PaymentEvent] = []
        self.degradations: list[DegradationEvent] = []
        self.actions: list[RecoveryAction] = []
        self.audit_log: list[dict] = []
        self.narration_feed: list[dict] = []

        self.policy: DecisionPolicy = decision_policy or RuleBasedPolicy()

        # rolling window per segment for baseline comparison
        self.segment_window: dict[str, deque] = defaultdict(lambda: deque(maxlen=40))
        # FIX(adaptive-baseline) + FIX(baseline-timescale): a separate, much
        # longer rolling window used only for the "normal" baseline, decoupled
        # from the short window above that's used for live anomaly detection.
        self.segment_baseline_window: dict[str, deque] = defaultdict(lambda: deque(maxlen=BASELINE_WINDOW_SIZE))
        # retry attempt counts per transaction (compliance bound)
        self.retry_counts: dict[str, int] = defaultdict(int)
        # track which segments are currently flagged systemic (paused) and since when
        self.paused_segments: dict[str, float] = {}
        # FIX(baseline-contamination): segments currently inside an active
        # degradation (systemic OR isolated) — baseline updates are frozen
        # for these so the "normal" baseline doesn't chase the anomaly itself.
        self.active_degradation_segments: set[str] = set()
        # consecutive healthy samples observed per paused segment, for FIX(unpause-bug)
        self._healthy_streak: dict[str, int] = defaultdict(int)

        # Outcomes are retained both by cause and fine-grained segment context.
        self._action_outcomes: dict[str, list[bool]] = defaultdict(list)

        # FIX(real-metrics): detection timing + false positive tracking
        self._segment_degradation_start: dict[str, float] = {}

    def _narrate(self, message: str, event_type: str, **details):
        self.narration_feed.append({"timestamp": datetime.utcnow().isoformat(),
                                    "type": event_type, "message": message, **details})

    # -------------------------------------------------------------------
    # 1. DETECT
    # -------------------------------------------------------------------
    def ingest_event(self, event: PaymentEvent):
        self.events.append(event)
        self._log("event_ingested", {"txn_id": event.id, "status": event.status,
                                      "bank": event.bank, "method": event.method})

        segment_key = f"{event.bank}|{event.method}"
        is_failure = 1 if event.status == "failed" else 0
        window = self.segment_window[segment_key]
        # Keep the long-term baseline strictly behind the live detection window.
        # Otherwise a new burst is added to both calculations before it can be
        # flagged, which lets a fresh segment's baseline chase the outage.
        aged_out_sample = window[0] if len(window) == window.maxlen else None
        window.append(is_failure)

        # FIX(adaptive-baseline) + FIX(baseline-timescale): push into the long
        # baseline window only while the segment is NOT currently inside an
        # active degradation — this prevents the "normal" baseline from being
        # contaminated by (and chasing) the anomaly itself.
        if segment_key not in self.active_degradation_segments and aged_out_sample is not None:
            self.segment_baseline_window[segment_key].append(aged_out_sample)

        baseline_window = self.segment_baseline_window[segment_key]
        if len(baseline_window) >= BASELINE_MIN_SAMPLES:
            baseline = sum(baseline_window) / len(baseline_window)
        else:
            baseline = DEFAULT_BASELINE_FAILURE_RATE

        if len(window) >= MIN_SAMPLES_BEFORE_DETECTION:
            failure_rate = sum(window) / len(window)

            if segment_key in self.active_degradation_segments:
                self._check_for_recovery(segment_key, failure_rate, baseline)
            elif failure_rate - baseline >= DEGRADATION_THRESHOLD:
                self._handle_degradation(segment_key, failure_rate, baseline, event)

        if event.status == "failed":
            self._diagnose_and_decide(event)

    def _handle_degradation(self, segment_key: str, failure_rate: float,
                             baseline: float, sample_event: PaymentEvent):
        # Detection can happen when the threshold is crossed by a successful
        # event. Diagnose from failed events in the affected window, not only
        # the triggering sample, so systemic outages are not mislabeled.
        recent_causes = [ERROR_CODE_TO_CAUSE.get(event.error_code, "unknown")
                         for event in self.events[-40:]
                         if f"{event.bank}|{event.method}" == segment_key and event.status == "failed"]
        cause = Counter(recent_causes).most_common(1)[0][0] if recent_causes else "unknown"
        systemic = cause in SYSTEMIC_CAUSES

        explanation = (
            f"Failure rate for {segment_key} hit {failure_rate:.0%} vs an adaptive "
            f"baseline of {baseline:.0%} for this segment. Dominant cause: {cause}. "
            + ("Classified as SYSTEMIC (bank/network side) — pausing retries and escalating."
               if systemic else
               "Classified as ISOLATED customer-side failures — targeted recovery will continue.")
        )

        deg = DegradationEvent(
            id=str(uuid.uuid4())[:8],
            timestamp=time.time(),
            segment_key=segment_key,
            failure_rate=failure_rate,
            baseline_at_detection=baseline,
            cause=cause,
            systemic=systemic,
            explanation=explanation,
        )
        self.degradations.append(deg)
        self._segment_degradation_start[segment_key] = deg.timestamp
        self.active_degradation_segments.add(segment_key)
        self._healthy_streak[segment_key] = 0
        self._log("degradation_detected", {"segment": segment_key, "cause": cause,
                                            "systemic": systemic, "failure_rate": round(failure_rate, 3),
                                            "baseline": round(baseline, 3)})
        affected = sum(1 for event in self.events[-40:]
                       if f"{event.bank}|{event.method}" == segment_key and event.status == "failed")
        state = "systemic outage" if systemic else "isolated degradation"
        self._narrate(f"{segment_key.replace('|', ' + ')} is experiencing a {state} caused by "
                      f"{cause.replace('_', ' ')}. I detected {affected} affected payments.",
                      "degradation_detected", segment=segment_key, cause=cause, affected_payments=affected)

        if systemic:
            self.paused_segments[segment_key] = time.time()
            self._log("segment_paused", {"segment": segment_key, "reason": "systemic issue detected"})
            self._narrate(f"I paused retries for {segment_key.replace('|', ' + ')} and escalated "
                          f"{affected} affected payments to protect customers from useless retries.",
                          "segment_paused", segment=segment_key, affected_payments=affected)

    def _check_for_recovery(self, segment_key: str, failure_rate: float, baseline: float):
        """
        FIX(unpause-bug): a paused segment is no longer paused forever.
        Once the failure rate has stayed close to baseline for
        RECOVERY_CONFIRMATION_SAMPLES consecutive events, we resume
        normal recovery behavior for that segment.
        """
        if failure_rate - baseline <= RECOVERY_FAILURE_RATE_MARGIN:
            self._healthy_streak[segment_key] += 1
        else:
            self._healthy_streak[segment_key] = 0

        if self._healthy_streak[segment_key] >= RECOVERY_CONFIRMATION_SAMPLES:
            self.active_degradation_segments.discard(segment_key)
            was_paused = self.paused_segments.pop(segment_key, None)
            self._healthy_streak.pop(segment_key, None)

            started_at = self._segment_degradation_start.pop(segment_key, None)
            duration = (time.time() - started_at) if started_at else None

            # mark the most recent degradation event for this segment as resolved
            resolved_deg = None
            for deg in reversed(self.degradations):
                if deg.segment_key == segment_key and deg.resolved_at is None:
                    deg.resolved_at = time.time()
                    # Short, low-impact incidents are flagged for review as possible false positives.
                    affected = sum(1 for event in self.events if f"{event.bank}|{event.method}" == segment_key
                                   and event.status == "failed" and deg.timestamp <= event.timestamp <= deg.resolved_at)
                    deg.was_false_positive = bool(duration is not None and duration < 5 and affected <= 3)
                    resolved_deg = deg
                    break

            self._log("segment_unpaused" if was_paused else "isolated_degradation_resolved", {
                "segment": segment_key,
                "reason": "failure rate returned to baseline",
                "outage_duration_seconds": round(duration, 1) if duration else None,
            })
            if was_paused:
                self._narrate(f"{segment_key.replace('|', ' + ')} has recovered. I resumed normal retry behavior "
                              f"after {self._healthy_streak.get(segment_key, RECOVERY_CONFIRMATION_SAMPLES)} healthy checks.",
                              "segment_recovered", segment=segment_key)

    # -------------------------------------------------------------------
    # 2. DIAGNOSE + 3. DECIDE (cost- and confidence-aware)
    # -------------------------------------------------------------------
    def _diagnose_and_decide(self, event: PaymentEvent):
        cause = ERROR_CODE_TO_CAUSE.get(event.error_code, "unknown")
        segment_key = f"{event.bank}|{event.method}"

        attempts_so_far = self.retry_counts[event.id]
        segment_is_paused = segment_key in self.paused_segments

        success_rates = self._current_success_rates(segment_key, cause)

        action_type, explanation, confidence = self.policy.decide(
            cause=cause,
            attempts_so_far=attempts_so_far,
            segment_paused=segment_is_paused,
            amount=event.amount,
            success_rates=success_rates,
        )
        policy_source = getattr(self.policy, "last_decision_source", "rule_based")

        # FIX(cost-awareness): compute expected value of taking this action
        # using the engine's current BELIEF about success probability.
        # If a tiny transaction's expected recovered value doesn't clear the
        # action's operational cost, skip acting rather than spend more to
        # recover it than it's worth.
        believed_p_success = success_rates.get(action_type, PRIOR_SUCCESS_RATE.get(action_type, 0.3))
        cost = ACTION_COST.get(action_type, 1.0)
        expected_value = believed_p_success * event.amount - cost

        if confidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD:
            action = RecoveryAction(
                id=str(uuid.uuid4())[:8], timestamp=time.time(), txn_id=event.id,
                cause=cause, action_type=action_type, explanation=explanation,
                amount=event.amount, outcome="pending_human_review",
                expected_value=round(expected_value, 2), confidence=confidence,
                policy_source=policy_source,
            )
            self.actions.append(action)
            self._log("human_review_required", {"txn_id": event.id, "cause": cause,
                "recommended_action": action_type, "confidence": confidence, "policy_source": policy_source})
            self._narrate(f"I recommended {action_type.replace('_', ' ')} for a ₹{event.amount:.0f} "
                          f"{cause.replace('_', ' ')} payment, but my confidence is only {confidence:.0%}. "
                          "I need a human reviewer to decide.", "human_review_required", txn_id=event.id)
            return

        if action_type not in ("escalate", "closed") and expected_value <= 0:
            action = RecoveryAction(
                id=str(uuid.uuid4())[:8], timestamp=time.time(), txn_id=event.id,
                cause=cause, action_type="skipped",
                explanation=(
                    f"Would have chosen '{action_type}' but expected value "
                    f"(₹{expected_value:.2f}) does not clear action cost (₹{cost:.2f}) "
                    f"for a ₹{event.amount:.2f} transaction — not worth acting on."
                ),
                amount=event.amount, outcome="skipped",
                expected_value=expected_value, confidence=confidence, policy_source=policy_source,
            )
            self.actions.append(action)
            self._log("recovery_action", {"txn_id": event.id, "cause": cause,
                                           "action": "skipped", "outcome": "skipped",
                                           "amount": event.amount, "policy_source": policy_source})
            self._narrate(f"A ₹{event.amount:.0f} payment failed due to {cause.replace('_', ' ')}, "
                          "but the expected recovery value does not justify a retry — I skipped it.",
                          "action_skipped", txn_id=event.id, cause=cause, amount=event.amount)
            return

        action = RecoveryAction(
            id=str(uuid.uuid4())[:8], timestamp=time.time(), txn_id=event.id,
            cause=cause, action_type=action_type, explanation=explanation,
            amount=event.amount, outcome="pending",
            expected_value=round(expected_value, 2), confidence=confidence,
            policy_source=policy_source,
        )

        if action_type in ("nudge_alt_method", "send_comms"):
            action.communication_language = "Hinglish"
            action.customer_message = self._hinglish_recovery_message(cause, event.amount)

        # FIX(self-referential-learning-bug): simulated outcomes are drawn
        # from the fixed ground-truth rate, NOT the engine's evolving belief —
        # only the belief (success_rates / learned_success_rates) should be
        # used for decision-making and EV math, never for generating the
        # simulated result itself.
        if action_type == "smart_retry":
            self.retry_counts[event.id] += 1
            success = random.random() < TRUE_SUCCESS_RATE.get(action_type, 0.3)
            action.outcome = "recovered" if success else "failed"
            self._record_outcome(segment_key, cause, action_type, success)
        elif action_type in ("nudge_alt_method", "send_comms"):
            success = random.random() < TRUE_SUCCESS_RATE.get(action_type, 0.3)
            action.outcome = "recovered" if success else "pending"
            self._record_outcome(segment_key, cause, action_type, success)
        elif action_type == "escalate":
            action.outcome = "pending"
        elif action_type == "closed":
            action.outcome = "failed"

        self.actions.append(action)
        self._log("recovery_action", {
            "txn_id": event.id, "cause": cause, "action": action_type,
            "outcome": action.outcome, "amount": event.amount,
            "expected_value": action.expected_value, "confidence": confidence,
            "policy_source": policy_source,
        })
        if action_type == "escalate":
            self._narrate(f"I recommended escalation for a {cause.replace('_', ' ')} transaction — "
                          "this needs manual review.", "action_escalated", txn_id=event.id, cause=cause)

    @staticmethod
    def _hinglish_recovery_message(cause: str, amount: float) -> str:
        """Short, customer-safe payment recovery copy for the Hindi-English demo flow."""
        amount_text = f"₹{amount:.0f}"
        if cause == "expired_card":
            return (f"Aapka {amount_text} payment complete nahi hua kyunki card expired hai. "
                    "Naya card update karein ya UPI se pay karein — payment link ready hai.")
        if cause == "otp_failure":
            return (f"Aapka {amount_text} payment OTP issue ki wajah se ruk gaya. "
                    "Koi tension nahi — naye payment link se jab convenient ho tab complete karein.")
        if cause == "insufficient_funds":
            return (f"Aapka {amount_text} payment abhi complete nahi ho paaya. "
                    "Balance available hone par hum safe retry karenge; aap UPI se bhi pay kar sakte hain.")
        return (f"Aapka {amount_text} payment complete nahi hua. "
                "Aap secure payment link se dobara try kar sakte hain — hum aapki help ke liye yahin hain.")

    def _record_outcome(self, segment_key: str, cause: str, action_type: str, success: bool):
        self._action_outcomes[f"global|{action_type}"].append(success)
        self._action_outcomes[f"cause:{cause}|{action_type}"].append(success)
        self._action_outcomes[f"segment:{segment_key}:{cause}|{action_type}"].append(success)

    @staticmethod
    def _wilson_interval(outcomes: list[bool]) -> tuple[float, float]:
        n = len(outcomes)
        if not n:
            return 0.0, 1.0
        z, p = 1.96, sum(outcomes) / n
        denom = 1 + z * z / n
        centre = (p + z * z / (2 * n)) / denom
        margin = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / denom
        return centre - margin, centre + margin

    def _trusted_rate(self, outcomes: list[bool]) -> Optional[float]:
        low, high = self._wilson_interval(outcomes)
        if len(outcomes) >= MIN_OBSERVATIONS_BEFORE_TRUSTING_LEARNED_RATE and high - low <= LEARNED_RATE_MAX_WILSON_WIDTH:
            return sum(outcomes) / len(outcomes)
        return None

    def _current_success_rates(self, segment_key: Optional[str] = None, cause: Optional[str] = None) -> dict:
        """
        FIX(learning-loop): return observed success rates once enough real
        outcomes exist per action type, falling back to priors otherwise.
        This is intentionally simple (global per action_type, not yet
        segmented per cause+bank) — see NOTES-FOR-CODEX.md for the richer
        per-segment version Codex should build out.
        """
        rates = dict(PRIOR_SUCCESS_RATE)
        for action_type in PRIOR_SUCCESS_RATE:
            candidates = []
            if segment_key and cause:
                candidates.append(f"segment:{segment_key}:{cause}|{action_type}")
            if cause:
                candidates.append(f"cause:{cause}|{action_type}")
            candidates.append(f"global|{action_type}")
            for key in candidates:
                trusted = self._trusted_rate(self._action_outcomes.get(key, []))
                if trusted is not None:
                    rates[action_type] = trusted
                    break
        return rates

    # -------------------------------------------------------------------
    # Audit logging
    # -------------------------------------------------------------------
    def _log(self, event_type: str, payload: dict):
        self.audit_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            **payload,
        })

    # -------------------------------------------------------------------
    # Metrics for dashboard — FIX(real-metrics): actually computed, not aspirational
    # -------------------------------------------------------------------
    def get_metrics(self):
        total_failed_amount = sum(e.amount for e in self.events if e.status == "failed")
        recovered_amount = sum(a.amount for a in self.actions if a.outcome == "recovered")
        pending_amount = sum(a.amount for a in self.actions if a.outcome == "pending")
        review_amount = sum(a.amount for a in self.actions if a.outcome == "pending_human_review")
        skipped_amount = sum(a.amount for a in self.actions if a.outcome == "skipped")

        by_cause = defaultdict(lambda: {"at_risk": 0.0, "recovered": 0.0, "count": 0})
        for a in self.actions:
            by_cause[a.cause]["at_risk"] += a.amount
            by_cause[a.cause]["count"] += 1
            if a.outcome == "recovered":
                by_cause[a.cause]["recovered"] += a.amount

        recovery_rate = (recovered_amount / total_failed_amount * 100) if total_failed_amount else 0

        # Time-to-detection: average seconds between the first anomalous
        # sample in a segment's window and when the degradation was flagged.
        # Approximated here using event timestamps within the same segment
        # window at time of flagging vs. the flag's own timestamp.
        detection_delays = []
        for deg in self.degradations:
            window_events = [e for e in self.events if f"{e.bank}|{e.method}" == deg.segment_key
                              and e.timestamp <= deg.timestamp]
            if len(window_events) >= MIN_SAMPLES_BEFORE_DETECTION:
                first_relevant = window_events[-MIN_SAMPLES_BEFORE_DETECTION]
                detection_delays.append(deg.timestamp - first_relevant.timestamp)
        avg_time_to_detection = (sum(detection_delays) / len(detection_delays)) if detection_delays else None

        resolved = [d for d in self.degradations if d.resolved_at is not None]
        currently_paused = len(self.paused_segments)
        classified = [d for d in resolved if d.was_false_positive is not None]
        false_positive_rate = (sum(1 for d in classified if d.was_false_positive) / len(classified) * 100) if classified else 0.0

        return {
            "total_events": len(self.events),
            "total_failed": sum(1 for e in self.events if e.status == "failed"),
            "revenue_at_risk": round(total_failed_amount, 2),
            "revenue_at_risk_without_agent": round(total_failed_amount, 2),
            "revenue_recovered": round(recovered_amount, 2),
            "revenue_pending": round(pending_amount, 2),
            "revenue_pending_human_review": round(review_amount, 2),
            "revenue_skipped_low_value": round(skipped_amount, 2),
            "recovery_rate_pct": round(recovery_rate, 1),
            "degradation_events": len(self.degradations),
            "degradation_events_resolved": len(resolved),
            "false_positive_rate_pct": round(false_positive_rate, 1),
            "avg_time_to_detection_seconds": (
                round(avg_time_to_detection, 2) if avg_time_to_detection is not None else None
            ),
            "paused_segments": list(self.paused_segments.keys()),
            "currently_paused_count": currently_paused,
            "segments_monitored": len(self.segment_window),
            "learned_success_rates": self._current_success_rates(),
            "by_cause": by_cause,
        }


# ---------------------------------------------------------------------------
# Synthetic event generator (stands in for a real Razorpay webhook stream)
# ---------------------------------------------------------------------------

def generate_event(force_degradation: bool = False, force_recovery: bool = False) -> PaymentEvent:
    """
    force_degradation: biases heavily towards HDFC+UPI gateway timeouts to
        simulate a bank outage starting.
    force_recovery: biases towards normal HDFC+UPI success to simulate the
        same outage clearing up (for demonstrating the unpause fix).
    """
    if force_degradation:
        bank, method = "HDFC", "UPI"
        status = "failed" if random.random() < 0.75 else "success"
        error_code = "GATEWAY_TIMEOUT" if status == "failed" else None
    elif force_recovery:
        bank, method = "HDFC", "UPI"
        status = "failed" if random.random() < 0.08 else "success"
        error_code = "GATEWAY_TIMEOUT" if status == "failed" else None
    else:
        bank = random.choice(BANKS)
        method = random.choice(METHODS)
        status = "failed" if random.random() < 0.10 else "success"
        error_code = random.choice(list(ERROR_CODE_TO_CAUSE.keys())) if status == "failed" else None

    return PaymentEvent(
        id=str(uuid.uuid4())[:8],
        timestamp=time.time(),
        amount=round(random.uniform(200, 5000), 2),
        bank=bank,
        method=method,
        status=status,
        error_code=error_code,
        customer_id=f"cust_{random.randint(1000, 9999)}",
    )
