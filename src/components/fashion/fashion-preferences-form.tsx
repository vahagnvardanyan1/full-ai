"use client";

import { useState } from "react";
import { PhotoUpload } from "./photo-upload";
import type { FashionContext } from "@/lib/agents/types";

const STYLES = ["casual", "formal", "streetwear", "business casual", "minimal", "elegant"] as const;
const OCCASIONS = ["work", "date night", "wedding", "casual outing", "party", "travel"] as const;
const GENDERS = [
  { value: "", label: "Any", icon: "✦" },
  { value: "male", label: "Male", icon: "♂" },
  { value: "female", label: "Female", icon: "♀" },
] as const;
const BODY_TYPES = ["slim", "athletic", "average", "curvy", "plus-size"] as const;
const BUDGET_PRESETS = [
  { label: "Budget", min: 30, max: 100 },
  { label: "Mid-range", min: 50, max: 300 },
  { label: "Premium", min: 200, max: 800 },
  { label: "Custom", min: 0, max: 0 },
] as const;

interface FashionPreferencesFormProps {
  onSubmit: (context: FashionContext, message: string) => void;
  onClose: () => void;
}

export function FashionPreferencesForm({ onSubmit, onClose }: FashionPreferencesFormProps) {
  const [step, setStep] = useState(0);
  const [budgetPreset, setBudgetPreset] = useState(1);
  const [budgetMin, setBudgetMin] = useState(50);
  const [budgetMax, setBudgetMax] = useState(300);
  const [style, setStyle] = useState<string>("casual");
  const [occasion, setOccasion] = useState<string>("casual outing");
  const [gender, setGender] = useState<string>("");
  const [bodyType, setBodyType] = useState<string>("");
  const [colorPreferences, setColorPreferences] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const handleBudgetPreset = (idx: number) => {
    setBudgetPreset(idx);
    if (idx < 3) {
      setBudgetMin(BUDGET_PRESETS[idx].min);
      setBudgetMax(BUDGET_PRESETS[idx].max);
    }
  };

  const handleSubmit = () => {
    const context: FashionContext = {
      budget: { min: budgetMin, max: budgetMax, currency: "USD" },
      style,
      occasion,
      ...(gender && { gender }),
      ...(bodyType && { bodyType }),
      ...(colorPreferences && { colorPreferences }),
      ...(photoUrl && { photoUrl }),
    };

    const message = `Style me a ${style} outfit for ${occasion} within $${budgetMin}–$${budgetMax}${colorPreferences ? `, preferring ${colorPreferences} colors` : ""}`;
    onSubmit(context, message);
  };

  const totalSteps = 3;
  const canNext = step < totalSteps - 1;
  const canSubmit = step === totalSteps - 1;

  const chipClass = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-[0.78rem] font-medium border cursor-pointer transition-all select-none ${
      active
        ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.3)] shadow-[0_0_12px_rgba(34,197,94,0.15)]"
        : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--surface-border)] hover:text-[var(--text)] hover:border-[var(--idle-border)]"
    }`;

  const sectionTitle = "text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2.5";
  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text)] text-[0.82rem] outline-none focus:border-[rgba(34,197,94,0.3)] transition-colors";

  return (
    <div
      className="w-full overflow-hidden"
      style={{ animation: "slide-in 0.35s ease-out forwards" }}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["Style & Occasion", "Budget & Fit", "Extras"].map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className="flex items-center gap-2 cursor-pointer bg-transparent border-none p-0"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold transition-all"
              style={{
                background: i <= step ? "linear-gradient(135deg, #22c55e, #16a34a)" : "var(--surface-raised)",
                color: i <= step ? "#fff" : "var(--text-muted)",
                border: i <= step ? "none" : "1px solid var(--surface-border)",
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className="text-[0.72rem] font-medium hidden sm:inline transition-colors"
              style={{ color: i === step ? "var(--text)" : "var(--text-muted)" }}
            >
              {label}
            </span>
            {i < 2 && (
              <div
                className="w-8 h-px mx-1"
                style={{ background: i < step ? "#22c55e" : "var(--surface-border)" }}
              />
            )}
          </button>
        ))}

        <button
          onClick={onClose}
          className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
          title="Cancel"
        >
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Step 0: Style & Occasion */}
      {step === 0 && (
        <div className="flex flex-col gap-5" style={{ animation: "slide-in 0.25s ease-out" }}>
          <div>
            <div className={sectionTitle}>What&apos;s your style?</div>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s} type="button" onClick={() => setStyle(s)} className={chipClass(style === s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className={sectionTitle}>What&apos;s the occasion?</div>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button key={o} type="button" onClick={() => setOccasion(o)} className={chipClass(occasion === o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Budget & Fit */}
      {step === 1 && (
        <div className="flex flex-col gap-5" style={{ animation: "slide-in 0.25s ease-out" }}>
          <div>
            <div className={sectionTitle}>Budget range</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {BUDGET_PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleBudgetPreset(i)}
                  className={chipClass(budgetPreset === i)}
                >
                  {preset.label}
                  {i < 3 && (
                    <span className="ml-1 text-[0.65rem] opacity-60">${preset.min}–${preset.max}</span>
                  )}
                </button>
              ))}
            </div>
            {budgetPreset === 3 && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(Number(e.target.value))}
                  className={inputClass}
                  placeholder="Min"
                  style={{ maxWidth: 120 }}
                />
                <span className="text-[var(--text-muted)] text-[0.78rem]">to</span>
                <input
                  type="number"
                  min={0}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(Number(e.target.value))}
                  className={inputClass}
                  placeholder="Max"
                  style={{ maxWidth: 120 }}
                />
                <span className="text-[var(--text-muted)] text-[0.72rem]">USD</span>
              </div>
            )}
          </div>
          <div className="flex gap-6">
            <div className="flex-1">
              <div className={sectionTitle}>Gender</div>
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGender(g.value)}
                    className={chipClass(gender === g.value)}
                  >
                    <span className="mr-1">{g.icon}</span> {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className={sectionTitle}>Body type</div>
              <div className="flex flex-wrap gap-1.5">
                {BODY_TYPES.map((b) => (
                  <button key={b} type="button" onClick={() => setBodyType(bodyType === b ? "" : b)} className={chipClass(bodyType === b)}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Extras */}
      {step === 2 && (
        <div className="flex flex-col gap-5" style={{ animation: "slide-in 0.25s ease-out" }}>
          <div>
            <div className={sectionTitle}>Color preferences</div>
            <input
              type="text"
              value={colorPreferences}
              onChange={(e) => setColorPreferences(e.target.value)}
              className={inputClass}
              placeholder="e.g. earth tones, pastels, navy & white..."
            />
          </div>
          <div>
            <div className={sectionTitle}>Your photo (for virtual try-on)</div>
            <PhotoUpload onUpload={setPhotoUrl} value={photoUrl} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[var(--surface-border)]">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-4 py-2.5 rounded-xl border border-[var(--surface-border)] bg-transparent text-[var(--text-muted)] text-[0.82rem] font-medium cursor-pointer hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-all"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {canNext && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="px-5 py-2.5 rounded-xl border-none font-semibold text-white text-[0.82rem] cursor-pointer transition-all hover:scale-[1.02] shadow-[0_2px_12px_rgba(34,197,94,0.25)]"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            Next
          </button>
        )}
        {canSubmit && (
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl border-none font-semibold text-white text-[0.82rem] cursor-pointer transition-all hover:scale-[1.02] shadow-[0_2px_16px_rgba(34,197,94,0.35)]"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            Get Styled ✦
          </button>
        )}
      </div>
    </div>
  );
}
