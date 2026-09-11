import { useState } from 'react';
import { Sparkles, Cpu, ShieldCheck, Check, Key, User, Briefcase, Lock } from 'lucide-react';
import { LLMProvider, saveProviderKey, setActiveModelId } from '@/lib/parser/hybridParser';
import { Settings } from '@/lib/storage/offlineDb';

export function OnboardingModal({
  currentSettings,
  onComplete,
}: {
  currentSettings: Settings;
  onComplete: (settings: Settings) => void;
}) {
  const [operatorName, setOperatorName] = useState(currentSettings.operatorName || 'My Workshop');
  const [businessType, setBusinessType] = useState(currentSettings.businessType || 'Custom Tailoring & Studio');
  const [aiChoice, setAiChoice] = useState<'managed' | 'custom' | 'offline'>('managed');
  const [customKey, setCustomKey] = useState('');

  const domainOptions = [
    'Custom Tailoring & Studio',
    'Home Bakery & Desserts',
    'Tiffin & Meal Delivery',
    'Electrical & Home Appliance Repair',
    'Salon & Wellness Studio',
    'Freelance Services & Repairs',
  ];

  const handleFinish = () => {
    if (aiChoice === 'managed') {
      setActiveModelId('gemini-3.6-flash');
    } else if (aiChoice === 'custom' && customKey.trim()) {
      saveProviderKey('gemini', customKey.trim());
      setActiveModelId('gemini-3.6-flash');
    } else {
      setActiveModelId('offline-engine');
    }

    const updatedSettings: Settings = {
      ...currentSettings,
      operatorName: operatorName.trim() || 'My Workshop',
      businessType: businessType.trim() || 'Custom Tailoring & Studio',
    };

    localStorage.setItem('janvyapar_onboarded', 'true');
    onComplete(updatedSettings);
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <section
        className="modal"
        style={{
          maxWidth: 540,
          width: '100%',
          borderRadius: 20,
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--card-border))',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--accent)))',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              D
            </span>
            <div>
              <div className="eyebrow" style={{ fontSize: 10 }}>Sovereign Device Setup</div>
              <h2 style={{ fontSize: 20, margin: '2px 0 0' }}>Welcome to JanVyapar</h2>
            </div>
          </div>
          <p className="minor" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>
            Personalize your on-device workshop identity and choose your AI engine preference.
          </p>
        </div>

        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Operator Name */}
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={13} /> Operator / Workshop Name
            </label>
            <input
              className="input"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. Aman, Priya's Bakery, Ramesh Tailors"
              autoFocus
            />
          </div>

          {/* Business Category */}
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={13} /> Business Category
            </label>
            <input
              className="input"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Custom Tailoring & Studio"
              list="domain-suggestions"
            />
            <datalist id="domain-suggestions">
              {domainOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          {/* AI Engine & Private API Key */}
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} /> Natural Language AI Engine
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {/* Option 1: Managed Cloud AI */}
              <div
                style={{
                  border: `1.5px solid ${aiChoice === 'managed' ? 'hsl(var(--secondary))' : 'hsl(var(--border))'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: aiChoice === 'managed' ? 'hsl(var(--secondary)/.08)' : 'hsl(var(--card))',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.18s ease',
                }}
                onClick={() => setAiChoice('managed')}
              >
                <input
                  type="radio"
                  name="aiChoice"
                  checked={aiChoice === 'managed'}
                  onChange={() => setAiChoice('managed')}
                  style={{ accentColor: 'hsl(var(--secondary))' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: 13 }}>JanVyapar Managed AI (Recommended)</strong>
                    <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '1px 6px', borderRadius: 99, fontWeight: 700, textTransform: 'uppercase' }}>
                      Zero Setup
                    </span>
                  </div>
                  <small style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                    Powered by Google Gemini 3.6 Flash. Ready to use immediately with zero configuration.
                  </small>
                </div>
              </div>

              {/* Option 2: Custom API Key */}
              <div
                style={{
                  border: `1.5px solid ${aiChoice === 'custom' ? 'hsl(var(--secondary))' : 'hsl(var(--border))'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: aiChoice === 'custom' ? 'hsl(var(--secondary)/.08)' : 'hsl(var(--card))',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.18s ease',
                }}
                onClick={() => setAiChoice('custom')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="radio"
                    name="aiChoice"
                    checked={aiChoice === 'custom'}
                    onChange={() => setAiChoice('custom')}
                    style={{ accentColor: 'hsl(var(--secondary))' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>Input My Own Gemini / OpenAI Key</strong><br />
                    <small style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                      Bring your own personal API key saved securely on this device only.
                    </small>
                  </div>
                </div>

                {aiChoice === 'custom' && (
                  <div style={{ marginTop: 4, paddingLeft: 26 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="password"
                      className="input"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="Paste your Gemini API key (AQ... or AIza...)"
                    />
                  </div>
                )}
              </div>

              {/* Option 3: Local Offline NLP */}
              <div
                style={{
                  border: `1.5px solid ${aiChoice === 'offline' ? 'hsl(var(--secondary))' : 'hsl(var(--border))'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: aiChoice === 'offline' ? 'hsl(var(--secondary)/.08)' : 'hsl(var(--card))',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.18s ease',
                }}
                onClick={() => setAiChoice('offline')}
              >
                <input
                  type="radio"
                  name="aiChoice"
                  checked={aiChoice === 'offline'}
                  onChange={() => setAiChoice('offline')}
                  style={{ accentColor: 'hsl(var(--secondary))' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: 13 }}>Local Offline NLP Engine</strong>
                    <span style={{ fontSize: 9, background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', padding: '1px 6px', borderRadius: 99, fontWeight: 700, textTransform: 'uppercase' }}>
                      100% Offline
                    </span>
                  </div>
                  <small style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                    Zero network usage, runs on-device rule regex & Indian colloquial dictionary.
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'hsl(var(--muted)/.4)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
            }}
          >
            <ShieldCheck size={18} color="#10b981" style={{ flexShrink: 0 }} />
            <span>
              <strong>Zero Data Exposure:</strong> All customer records are kept strictly in this device's browser database.
            </span>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 14, marginTop: 4 }}
            onClick={handleFinish}
          >
            <Check size={16} /> Launch My Sovereign Workbench
          </button>
        </div>
      </section>
    </div>
  );
}
