import "./PhoneMockup.css";

export default function PhoneMockup() {
  return (
    <div className="phone-mockup">
      <div className="phone-screen">
        {/* Dynamic island */}
        <div className="phone-notch" />

        {/* Status bar */}
        <div className="phone-status-bar">
          <span>10:30</span>
          <span className="phone-status-icons">
            <span>ıll</span>
            <span>▲</span>
            <span className="phone-battery" />
          </span>
        </div>

        {/* Header */}
        <div className="phone-header">
          <div className="phone-header-left">
            <span className="phone-back">←</span>
            <div className="phone-avatar" />
            <div className="phone-header-text">
              <p className="phone-title">Aitbaar AI</p>
              <span className="phone-online">online</span>
            </div>
          </div>
          <div className="phone-header-right">
            <span className="phone-header-icon">📹</span>
            <span className="phone-header-icon">📞</span>
            <span className="phone-header-menu">⋮</span>
          </div>
        </div>

        {/* Chat */}
        <div className="phone-chat">
          <span className="phone-date-chip">Today</span>

          {/* Voice note */}
          <div className="phone-voice">
            <div className="phone-voice-icon">🎤</div>
            <div className="phone-voice-body">
              <p className="phone-voice-label">Voice Note</p>
              <div className="phone-voice-player">
                <span className="phone-voice-play">▶</span>
                <div className="phone-voice-wave">
                  <span className="phone-voice-knob" />
                </div>
              </div>
              <div className="phone-voice-meta">
                <span>0:12</span>
                <span className="phone-voice-time">
                  10:30 AM <span className="phone-read-check">✓✓</span>
                </span>
              </div>
            </div>
          </div>

          {/* Received message */}
          <div className="phone-message">
            <p className="phone-message-text">
              Payment of Rs 20,000 has been recorded.
            </p>
            <span className="phone-message-time">10:31 AM</span>
          </div>

          {/* Trust score card */}
          <div className="phone-trust-card">
            <p className="phone-trust-label">Trust Score</p>
            <p className="phone-trust-score">94</p>
            <p className="phone-trust-status">
              Safe Member <span>✅</span>
            </p>
            <span className="phone-trust-time">10:31 AM</span>
          </div>
        </div>

        {/* Input */}
        <div className="phone-input-row">
          <div className="phone-input">
            <span className="phone-input-emoji">😊</span>
            <span className="phone-input-placeholder">Type a message</span>
            <span className="phone-input-attach">📎</span>
            <span className="phone-input-camera">📷</span>
          </div>
          <div className="phone-mic">🎤</div>
        </div>

        {/* Home indicator */}
        <div className="phone-home-indicator" />
      </div>
    </div>
  );
}
