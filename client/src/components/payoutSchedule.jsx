import { useState, useEffect, useCallback } from "react";
import { Lock, Edit3, AlertTriangle } from "lucide-react";
import "./PayoutSchedule.css";

const API_BASE = "http://localhost:5000";

async function fetchSchedule(committeeId) {
  const res = await fetch(`${API_BASE}/api/payout/${committeeId}`);
  return res.json();
}

async function generateAuto(committeeId) {
  const res = await fetch(`${API_BASE}/api/payout/${committeeId}/auto`, { method: "POST" });
  return res.json();
}

async function saveManual(committeeId, memberOrders) {
  const res = await fetch(`${API_BASE}/api/payout/${committeeId}/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberOrders }),
  });
  return res.json();
}

// ── Manual Instructions Popup ──────────────────────
function ManualInstructionPopup({ onProceed, onClose }) {
  return (
    <div className="payout-overlay">
      <div className="payout-popup">
        <button onClick={onClose} className="payout-popup-close">&times;</button>
        <span className="payout-popup-icon">📋</span>
        <h3 className="payout-popup-title">Manual Payout Schedule</h3>
        <p className="payout-popup-subtitle">
          You are in full control. Here's how it works:
        </p>
        <div className="payout-instruction-list">
          {          [
            "Enter a payout position number (1, 2, 3...) for each member. 1 means they get paid first.",
            "Every member must have a unique position — no two members can share the same slot.",
            "You can update, change, or reorder anytime in manual mode.",
            "Click Save Schedule when done. Changes take effect immediately.",
            "Once you switch to manual mode, AI payout generation will be permanently locked for this committee.",
          ].map((instruction, i) => (
            <div key={i} className="payout-instruction-item">
              <span className="payout-instruction-dot">{i + 1}</span>
              <span>{instruction}</span>
            </div>
          ))}
        </div>
        <button onClick={onProceed} className="payout-popup-proceed-btn">
          Got it — Let me set it up
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────
export default function PayoutSchedule({ committeeId, members, showSwitchToManual = false, showActions = true }) {
  const [schedule, setSchedule] = useState([]);
  const [scheduleType, setScheduleType] = useState(null); // null | "auto" | "manual"
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [manualOrders, setManualOrders] = useState({});

  const loadSchedule = useCallback(async () => {
    if (!committeeId) return;
    setLoading(true);
    try {
      const data = await fetchSchedule(committeeId);
      if (data.success && data.schedule.length > 0) {
        setSchedule(data.schedule);
        setScheduleType(data.type);
        // Pre-fill manual orders
        const orders = {};
        data.schedule.forEach((s) => { orders[s.member_id] = s.payout_order; });
        setManualOrders(orders);
      } else {
        setSchedule([]);
        setScheduleType(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [committeeId]);

    useEffect(() => {
      const timer = setTimeout(() => { loadSchedule(); }, 0);
      return () => clearTimeout(timer);
    }, [loadSchedule]);

  async function handleAutoGenerate() {
    setGenerating(true);
    setError("");
    try {
      const data = await generateAuto(committeeId);
      if (!data.success) throw new Error(data.error);
      setSchedule(data.schedule);
      setScheduleType("auto");
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  // When switching from AI to Manual, pre-fill the manual orders from current AI schedule
  function handleSwitchToManual() {
    const orders = {};
    schedule.forEach((s) => { orders[s.member_id] = s.payout_order; });
    setManualOrders(orders);
    setShowInstructions(true);
  }

  async function handleSaveManual() {
    // Validate unique orders
    const values = Object.values(manualOrders).map(Number);
    const unique = new Set(values);
    if (unique.size !== values.length) {
      setError("Duplicate positions found. Each member must have a unique position number.");
      return;
    }
    if (values.some((v) => v < 1 || v > members.length)) {
      setError(`Position numbers must be between 1 and ${members.length}.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const memberOrders = Object.entries(manualOrders).map(([memberId, payoutOrder]) => ({
        memberId,
        payoutOrder: Number(payoutOrder),
      }));
      const data = await saveManual(committeeId, memberOrders);
      if (!data.success) throw new Error(data.error);
      setSchedule(data.schedule);
      setScheduleType("manual");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleResetManual() {
    if (!window.confirm("Reset payout schedule? Current assignments will be cleared.")) return;
    const orders = {};
    members.forEach((m, i) => { orders[m.id] = i + 1; });
    setManualOrders(orders);
    setSchedule([]);
    setScheduleType(null);
    setError("");
  }

  if (loading) {
    return (
      <div className="payout-card">
        <div className="payout-header"><p className="payout-title"> Payout Schedule</p></div>
        <p className="text-xs text-[#5C6270] px-5 py-4">Loading...</p>
      </div>
    );
  }

  return (
    <>
      {/* Manual Instructions Popup */}
      {showInstructions && (
        <ManualInstructionPopup
          onClose={() => setShowInstructions(false)}
          onProceed={() => {
            // If switching from AI, pre-fill orders from current schedule
            if (scheduleType === "auto") {
              const orders = {};
              schedule.forEach((s) => { orders[s.member_id] = s.payout_order; });
              setManualOrders(orders);
            } else {
              const orders = {};
              members.forEach((m, i) => { orders[m.id] = i + 1; });
              setManualOrders(orders);
            }
            setShowInstructions(false);
            setScheduleType("manual");
          }}
        />
      )}

      <div className="payout-card">
        <div className="payout-header">
          <p className="payout-title">
             Members
            {scheduleType === "auto" && (
              <span className="payout-locked-badge">
                <Lock size={10} className="inline mr-1" />AI Generated · Locked
              </span>
            )}
            {scheduleType === "manual" && (
              <span className="payout-manual-badge">
                <Edit3 size={10} className="inline mr-1" />Manual · Editable
              </span>
            )}
          </p>

{/* Reset button for manual — only in sidebar */}
          {scheduleType === "manual" && showActions && (
            <button onClick={handleResetManual} className="payout-reset-btn text-xs">
              Reset
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-[#FCEBEB] rounded-lg flex items-start gap-2">
            <AlertTriangle size={14} className="text-[#DC2626] shrink-0 mt-0.5" />
            <p className="text-xs text-[#DC2626]">{error}</p>
          </div>
        )}

            {/* No schedule yet — show Auto/Manual choice (Payouts sidebar only) or default table (Overview) */}
        {!scheduleType && showActions && (
          <div className="payout-choice-grid">
            <button
              className="payout-choice-btn payout-choice-btn-auto"
              onClick={handleAutoGenerate}
              disabled={generating || members.length === 0}
            >
              <span className="payout-choice-icon"></span>
              <p className="payout-choice-title text-[#1E3A5F]">
                {generating ? "AI is thinking..." : "Auto — Let AI Decide"}
              </p>
              <p className="payout-choice-desc">
                Gemini analyzes trust scores, payment history, and fairness to generate the optimal payout order. <strong>This will be locked after generation.</strong>
              </p>
            </button>

            <button
              className="payout-choice-btn payout-choice-btn-manual"
              onClick={() => setShowInstructions(true)}
              disabled={members.length === 0}
            >
              <span className="payout-choice-icon"></span>
              <p className="payout-choice-title text-[#B8792B]">Manual — I'll Decide</p>
              <p className="payout-choice-desc">
                You assign each member their payout position yourself. You can update, change, or reorder anytime.
              </p>
            </button>
          </div>
          
        )}
     {/* No schedule yet — default read-only members table (Overview only) */}
        {!scheduleType && !showActions && (
          <>
            <div className="overflow-x-auto">
              <table className="payout-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Member Name</th>
                    <th>Phone</th>
                    <th>Trust Score</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => {
                    const scoreVal = m.trust_score ?? 100;
                    const scoreBg = scoreVal >= 80 ? "#E8F5E9" : scoreVal >= 50 ? "#FFF8E1" : "#FFEBEE";
                    const scoreColor = scoreVal >= 80 ? "#1B5E20" : scoreVal >= 50 ? "#E65100" : "#B71C1C";
                    const payStatus = m.payment_status || "pending";
                    return (
                      <tr key={m.id}>
                        <td className="text-xs text-[#5C6270]">{idx + 1}</td>
                        <td className="font-medium">{m.name || "—"}</td>
                        <td className="text-xs text-[#5C6270]">{m.phone}</td>
                        <td>
                          <span className="payout-score-pill" style={{ background: scoreBg, color: scoreColor }}>
                            {scoreVal}
                          </span>
                        </td>
                        <td>
                          {payStatus === "confirmed" ? (
                            <span className="payout-status-confirmed">Confirmed</span>
                          ) : payStatus === "rejected" ? (
                            <span className="payout-status-rejected">Rejected</span>
                          ) : (
                            <span className="payout-status-pending">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {members.length === 0 && (
              <p className="text-xs text-[#5C6270] px-5 py-4">
                No members yet. Add members to get started.
              </p>
            )}
          </>
        )}

        {/* Auto schedule — locked, read-only */}
        {scheduleType === "auto" && schedule.length > 0 && (
          <div className="overflow-x-auto">
            <table className="payout-table">
              <thead>
                <tr>
                  <th>Payout Slot</th>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>Trust Score</th>
                  <th>Payment</th>
                  <th>Month</th>
                  <th>AI Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s) => {
                  const scoreVal = s.trust_score ?? 100;
                  const scoreBg = scoreVal >= 80 ? "#E8F5E9" : scoreVal >= 50 ? "#FFF8E1" : "#FFEBEE";
                  const scoreColor = scoreVal >= 80 ? "#1B5E20" : scoreVal >= 50 ? "#E65100" : "#B71C1C";
                  const payStatus = s.payment_status || "pending";
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="payout-order-badge">{s.payout_order}</div>
                      </td>
                      <td className="font-medium">{s.members?.name || "—"}</td>
                      <td className="text-xs text-[#5C6270]">{s.members?.phone}</td>
                      <td>
                        <span className="payout-score-pill" style={{ background: scoreBg, color: scoreColor }}>
                          {scoreVal}
                        </span>
                      </td>
                      <td>
                        {payStatus === "confirmed" ? (
                          <span className="payout-status-confirmed">Confirmed</span>
                        ) : payStatus === "rejected" ? (
                          <span className="payout-status-rejected">Rejected</span>
                        ) : (
                          <span className="payout-status-pending">Pending</span>
                        )}
                      </td>
                      <td className="text-xs text-[#5C6270]">{s.payment_month || "—"}</td>
                      <td className="text-xs text-[#5C6270] italic max-w-xs">{s.ai_reasoning || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className={`px-5 py-3 bg-[#E8EEF4] flex items-center ${showSwitchToManual ? "justify-between" : "justify-start"} gap-2`}>
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-[#1E3A5F]" />
                <p className="text-xs text-[#1E3A5F]">
                  AI has generated this payout order. Review it below.
                </p>
              </div>
              {showSwitchToManual && (
                <button
                  onClick={handleSwitchToManual}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#B8792B] text-white hover:bg-[#9A6320] transition"
                >
                  Switch to Manual
                </button>
              )}
            </div>
          </div>
        )}

        {/* Manual schedule — editable */}
        {scheduleType === "manual" && (
          <>
            <div className="overflow-x-auto">
              <table className="payout-table">
                <thead>
                  <tr>
                    <th>Member Name</th>
                    <th>Phone</th>
                    <th>Trust Score</th>
                    <th>Payment</th>
                    <th>Payout Position</th>
                   {showActions && <th>Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const currentOrder = manualOrders[m.id] || "";
                    // Check for duplicate
                    const allValues = Object.entries(manualOrders)
                      .filter(([id]) => id !== m.id)
                      .map(([, v]) => Number(v));
                    const isDuplicate = currentOrder && allValues.includes(Number(currentOrder));
                    const scoreVal = m.trust_score ?? 100;
                    const scoreBg = scoreVal >= 80 ? "#E8F5E9" : scoreVal >= 50 ? "#FFF8E1" : "#FFEBEE";
                    const scoreColor = scoreVal >= 80 ? "#1B5E20" : scoreVal >= 50 ? "#E65100" : "#B71C1C";
                    const payStatus = m.payment_status || "pending";

                    return (
                      <tr key={m.id}>
                        <td className="font-medium">{m.name || "—"}</td>
                        <td className="text-xs text-[#5C6270]">{m.phone}</td>
                        <td>
                          <span className="payout-score-pill" style={{ background: scoreBg, color: scoreColor }}>
                            {scoreVal}
                          </span>
                        </td>
                        <td>
                          {payStatus === "confirmed" ? (
                            <span className="payout-status-confirmed">Confirmed</span>
                          ) : payStatus === "rejected" ? (
                            <span className="payout-status-rejected">Rejected</span>
                          ) : (
                            <span className="payout-status-pending">Pending</span>
                          )}
                        </td>
                        <td>
                                           {showActions ? (
                            <input
                              type="number"
                              min={1}
                              max={members.length}
                              className={`payout-order-input ${isDuplicate ? "border-[#DC2626]" : ""}`}
                              value={currentOrder}
                              onChange={(e) => {
                                setManualOrders((prev) => ({ ...prev, [m.id]: e.target.value }));
                                setError("");
                              }}
                            />
                          ) : (
                                  <div className="payout-order-badge">{currentOrder || "—"}</div>
                          )}
                        </td>
                            {showActions && (
                          <td>
                            {isDuplicate ? (
                              <span className="text-xs text-[#DC2626]">⚠️ Duplicate</span>
                            ) : currentOrder ? (
                              <span className="text-xs text-[#1E6B4A]">✓ Set</span>
                            ) : (
                              <span className="text-xs text-[#5C6270]">Not set</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
                   {showActions && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#22262E]/8">
                <p className="text-xs text-[#5C6270]">
                  Assign positions 1–{members.length}. Position 1 gets paid first.
                </p>
                <button
                  onClick={handleSaveManual}
                  disabled={saving}
                  className="payout-save-btn disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            )}
          </>
        )}

        {members.length === 0 && !scheduleType && (
          <p className="text-xs text-[#5C6270] px-5 py-4">
            No members yet. Add members before setting up payout schedule.
          </p>
        )}
      </div>
    </>
  );
}