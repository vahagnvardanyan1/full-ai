"use client";

import { useMemo, useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import { PhotoUpload } from "./photo-upload";
import type { FashionContext, ScrapedProduct, OutfitItem } from "@/lib/agents/types";
import type { FashionFlowProps } from "./fashion-pipeline-flow";
import {
  ACCENT,
  ALL_BRANDS,
  Y_GAP,
  Y_GAP_MOBILE,
  cardStyle,
  handleStyle,
  StatusDots,
  nodeTypes as pipelineNodeTypes,
  useIsMobile,
  useDotColor,
} from "./fashion-pipeline-flow";
import type { PreferencesData, RetailerData, OutfitData, ImageData } from "./fashion-pipeline-flow";

// ── Constants ──────────────────────────────────────────

const FORM_NODE_WIDTH = 360;
const FORM_NODE_WIDTH_MOBILE = 290;
const X_GAP = 420;
const X_GAP_MOBILE = 330;

// ── Form options ───────────────────────────────────────

const STYLES = ["casual", "formal", "streetwear", "business casual", "minimal", "elegant"];
const OCCASIONS = ["work", "date night", "wedding", "casual outing", "party", "travel"];
const GENDERS = [
  { value: "", label: "Any", icon: "✦" },
  { value: "male", label: "Male", icon: "♂" },
  { value: "female", label: "Female", icon: "♀" },
] as const;
const BODY_TYPES = ["slim", "athletic", "average", "curvy", "plus-size"];
const BUDGET_PRESETS = [
  { label: "Budget", min: 30, max: 100 },
  { label: "Mid-range", min: 50, max: 300 },
  { label: "Premium", min: 200, max: 800 },
  { label: "Custom", min: 0, max: 0 },
] as const;

// ── Form state ─────────────────────────────────────────

interface FormState {
  style: string;
  occasion: string;
  budgetPreset: number;
  budgetMin: number;
  budgetMax: number;
  gender: string;
  bodyType: string;
  colorPreferences: string;
  photoUrl: string;
}

const defaultFormState: FormState = {
  style: "casual",
  occasion: "casual outing",
  budgetPreset: 1,
  budgetMin: 50,
  budgetMax: 300,
  gender: "",
  bodyType: "",
  colorPreferences: "",
  photoUrl: "",
};

// ── Chip ───────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nodrag nopan"
      style={{
        padding: "5px 10px",
        borderRadius: 10,
        fontSize: "0.7rem",
        fontWeight: 500,
        border: active
          ? "1px solid rgba(34,197,94,0.3)"
          : "1px solid var(--surface-border)",
        background: active ? "rgba(34,197,94,0.1)" : "var(--surface-raised)",
        color: active ? ACCENT : "var(--text-muted)",
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: active ? "0 0 8px rgba(34,197,94,0.15)" : "none",
        userSelect: "none" as const,
      }}
    >
      {label}
    </button>
  );
}

// ── Form step icons ────────────────────────────────────

function StyleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function ExtrasIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

const STEP_ICONS = [StyleIcon, BudgetIcon, ExtrasIcon];

// ── Form Step Node ─────────────────────────────────────

interface FormStepData {
  [key: string]: unknown;
  stepIndex: number;
  label: string;
  isActive: boolean;
  isCompleted: boolean;
  isPipeline: boolean;
  formState: FormState;
  onUpdate: (key: keyof FormState, value: string | number) => void;
  onBudgetPreset: (idx: number) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  mobile: boolean;
}

function FormStepNode({ data }: NodeProps<Node<FormStepData>>) {
  const {
    stepIndex, label, isActive, isCompleted, isPipeline,
    formState, onUpdate, onBudgetPreset, onNext, onBack, onSubmit, mobile,
  } = data;

  const w = mobile ? FORM_NODE_WIDTH_MOBILE : FORM_NODE_WIDTH;
  const status: "pending" | "working" | "done" = isActive ? "working" : isCompleted ? "done" : "pending";
  const IconComponent = STEP_ICONS[stepIndex];

  const sectionTitle: CSSProperties = {
    fontSize: "0.63rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: 6,
    marginTop: 2,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid var(--surface-border)",
    background: "var(--surface-raised)",
    color: "var(--text)",
    fontSize: "0.75rem",
    outline: "none",
  };

  return (
    <div style={{ animation: "slide-in 0.4s ease-out" }}>
      {stepIndex > 0 && (
        <Handle type="target" position={Position.Left} style={handleStyle("left")} />
      )}
      <div style={cardStyle({ status, width: w })}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: isCompleted || isActive
                ? `linear-gradient(135deg, ${ACCENT}, #16a34a)`
                : `${ACCENT}18`,
              border: isCompleted || isActive ? "none" : `1.5px solid ${ACCENT}50`,
            }}
          >
            {isCompleted ? (
              <span className="text-white text-[0.6rem] font-bold">&#10003;</span>
            ) : (
              <IconComponent />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[0.78rem] font-semibold text-[var(--text)]">{label}</div>
            <div className="text-[0.58rem] text-[var(--text-muted)]">
              {isActive && !isPipeline ? "Fill in details" : isCompleted ? "Completed" : "Pending"}
            </div>
          </div>
        </div>

        {/* Active: form inputs */}
        {isActive && !isPipeline && (
          <div className="flex flex-col gap-2.5 mt-1 nodrag nopan nowheel">
            {/* Step 0: Style & Occasion */}
            {stepIndex === 0 && (
              <>
                <div>
                  <div style={sectionTitle}>Style</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLES.map((s) => (
                      <Chip key={s} label={s} active={formState.style === s} onClick={() => onUpdate("style", s)} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={sectionTitle}>Occasion</div>
                  <div className="flex flex-wrap gap-1.5">
                    {OCCASIONS.map((o) => (
                      <Chip key={o} label={o} active={formState.occasion === o} onClick={() => onUpdate("occasion", o)} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 1: Budget & Fit */}
            {stepIndex === 1 && (
              <>
                <div>
                  <div style={sectionTitle}>Budget</div>
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_PRESETS.map((preset, i) => (
                      <Chip
                        key={preset.label}
                        label={`${preset.label}${i < 3 ? ` $${preset.min}-$${preset.max}` : ""}`}
                        active={formState.budgetPreset === i}
                        onClick={() => onBudgetPreset(i)}
                      />
                    ))}
                  </div>
                  {formState.budgetPreset === 3 && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        className="nodrag nopan"
                        value={formState.budgetMin}
                        onChange={(e) => onUpdate("budgetMin", Number(e.target.value))}
                        style={{ ...inputStyle, maxWidth: 80 }}
                        placeholder="Min"
                      />
                      <span className="text-[0.7rem] text-[var(--text-muted)]">to</span>
                      <input
                        type="number"
                        className="nodrag nopan"
                        value={formState.budgetMax}
                        onChange={(e) => onUpdate("budgetMax", Number(e.target.value))}
                        style={{ ...inputStyle, maxWidth: 80 }}
                        placeholder="Max"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div style={sectionTitle}>Gender</div>
                    <div className="flex flex-wrap gap-1.5">
                      {GENDERS.map((g) => (
                        <Chip key={g.value} label={`${g.icon} ${g.label}`} active={formState.gender === g.value} onClick={() => onUpdate("gender", g.value)} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div style={sectionTitle}>Body type</div>
                    <div className="flex flex-wrap gap-1">
                      {BODY_TYPES.map((b) => (
                        <Chip key={b} label={b} active={formState.bodyType === b} onClick={() => onUpdate("bodyType", formState.bodyType === b ? "" : b)} />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Extras */}
            {stepIndex === 2 && (
              <>
                <div>
                  <div style={sectionTitle}>Color preferences</div>
                  <input
                    type="text"
                    className="nodrag nopan"
                    value={formState.colorPreferences}
                    onChange={(e) => onUpdate("colorPreferences", e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. earth tones, pastels, navy..."
                  />
                </div>
                <div>
                  <div style={sectionTitle}>Your photo (optional)</div>
                  <div className="nodrag nopan">
                    <PhotoUpload onUpload={(url) => onUpdate("photoUrl", url)} value={formState.photoUrl} />
                  </div>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[var(--surface-border)]">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={onBack}
                  className="nodrag nopan px-3 py-1.5 rounded-lg text-[0.72rem] font-medium border border-[var(--surface-border)] bg-transparent text-[var(--text-muted)] cursor-pointer hover:text-[var(--text)] transition-all"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              {stepIndex < 2 && (
                <button
                  type="button"
                  onClick={onNext}
                  className="nodrag nopan px-4 py-1.5 rounded-lg text-[0.72rem] font-semibold text-white border-none cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, #16a34a)` }}
                >
                  Next
                </button>
              )}
              {stepIndex === 2 && (
                <button
                  type="button"
                  onClick={onSubmit}
                  className="nodrag nopan px-4 py-1.5 rounded-lg text-[0.72rem] font-semibold text-white border-none cursor-pointer transition-all hover:scale-[1.02] shadow-[0_2px_12px_rgba(34,197,94,0.3)]"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, #16a34a)` }}
                >
                  Get Styled
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed / Pipeline: summary */}
        {(isCompleted || isPipeline) && (
          <div className="flex flex-col gap-0.5 mt-1 text-[0.68rem] text-[var(--text-muted)]">
            {stepIndex === 0 && (
              <>
                <span><b className="text-[var(--text)]">Style:</b> {formState.style}</span>
                <span><b className="text-[var(--text)]">Occasion:</b> {formState.occasion}</span>
              </>
            )}
            {stepIndex === 1 && (
              <>
                <span><b className="text-[var(--text)]">Budget:</b> ${formState.budgetMin}&#8211;${formState.budgetMax}</span>
                {formState.gender && <span><b className="text-[var(--text)]">Gender:</b> {formState.gender}</span>}
                {formState.bodyType && <span><b className="text-[var(--text)]">Body:</b> {formState.bodyType}</span>}
              </>
            )}
            {stepIndex === 2 && (
              <>
                {formState.colorPreferences && <span><b className="text-[var(--text)]">Colors:</b> {formState.colorPreferences}</span>}
                {formState.photoUrl && <span>Photo uploaded</span>}
                {!formState.colorPreferences && !formState.photoUrl && <span>No extras</span>}
              </>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle("right")} />
    </div>
  );
}

// ── Unified node types ─────────────────────────────────

const unifiedNodeTypes = {
  formStepNode: FormStepNode,
  ...pipelineNodeTypes,
};

// ── Build unified graph ────────────────────────────────

interface BuildOptions {
  formStep: number;
  formState: FormState;
  isPipeline: boolean;
  preferences?: FashionFlowProps["preferences"];
  retailers: FashionFlowProps["retailers"];
  outfit?: FashionFlowProps["outfit"];
  image?: FashionFlowProps["image"];
  currentStage: string;
  callbacks: {
    onUpdate: (key: keyof FormState, value: string | number) => void;
    onBudgetPreset: (idx: number) => void;
    onNext: () => void;
    onBack: () => void;
    onSubmit: () => void;
  };
  mobile: boolean;
}

function buildUnifiedGraph(opts: BuildOptions): { nodes: Node[]; edges: Edge[] } {
  const {
    formStep, formState, isPipeline,
    preferences, retailers, outfit, image, currentStage,
    callbacks, mobile,
  } = opts;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const xGap = mobile ? X_GAP_MOBILE : X_GAP;
  const yGap = mobile ? Y_GAP_MOBILE : Y_GAP;
  const retailerCenterY = (ALL_BRANDS.length - 1) * yGap / 2;

  const formLabels = ["Style & Occasion", "Budget & Fit", "Extras"];
  const visibleSteps = isPipeline ? 3 : formStep + 1;

  // ── Form step nodes ──
  for (let i = 0; i < visibleSteps; i++) {
    const formY = isPipeline ? retailerCenterY - 20 : (mobile ? 20 : 60);

    nodes.push({
      id: `form-step-${i}`,
      type: "formStepNode",
      position: { x: i * xGap, y: formY },
      data: {
        stepIndex: i,
        label: formLabels[i],
        isActive: !isPipeline && i === formStep,
        isCompleted: isPipeline || i < formStep,
        isPipeline,
        formState,
        onUpdate: callbacks.onUpdate,
        onBudgetPreset: callbacks.onBudgetPreset,
        onNext: callbacks.onNext,
        onBack: callbacks.onBack,
        onSubmit: callbacks.onSubmit,
        mobile,
      } satisfies FormStepData,
      draggable: false,
    });

    if (i > 0) {
      const active = isPipeline || i <= formStep;
      edges.push({
        id: `form-${i - 1}->form-${i}`,
        source: `form-step-${i - 1}`,
        target: `form-step-${i}`,
        type: "smoothstep",
        animated: !isPipeline && i === formStep,
        style: {
          stroke: active ? `${ACCENT}80` : "var(--rf-edge-idle, rgba(255,255,255,0.1))",
          strokeWidth: active ? 2 : 1.5,
        },
      });
    }
  }

  // ── Pipeline nodes (running / done) ──
  if (isPipeline) {
    const stageOrder = [
      "parsing_preferences",
      "scraping_products",
      "assembling_outfit",
      "generating_image",
      "complete",
    ];
    const stageIdx = stageOrder.indexOf(currentStage);
    const pipelineX = 3 * xGap;

    // Preferences
    const prefsStatus: "pending" | "working" | "done" =
      stageIdx >= 1 || preferences ? "done" : stageIdx === 0 ? "working" : "pending";

    nodes.push({
      id: "preferences",
      type: "preferencesNode",
      position: { x: pipelineX, y: retailerCenterY - 20 },
      data: {
        preferences,
        photoUrl: formState.photoUrl || undefined,
        nodeStatus: prefsStatus,
        mobile,
      } satisfies PreferencesData,
      draggable: false,
      selectable: false,
    });

    edges.push({
      id: "form-2->preferences",
      source: "form-step-2",
      target: "preferences",
      type: "smoothstep",
      animated: prefsStatus === "working",
      style: {
        stroke: prefsStatus !== "pending" ? `${ACCENT}80` : "var(--rf-edge-idle)",
        strokeWidth: prefsStatus !== "pending" ? 2 : 1.5,
      },
    });

    // Retailers
    const retailerIds: string[] = [];
    ALL_BRANDS.forEach((brand, i) => {
      const id = `retailer-${brand}`;
      retailerIds.push(id);
      const retailerData = retailers.get(brand);

      let nodeStatus: "pending" | "working" | "done" | "error" = "pending";
      if (retailerData) {
        nodeStatus = retailerData.status === "loading" ? "working" : retailerData.status;
      } else if (stageIdx >= 1) {
        nodeStatus = "working";
      }

      nodes.push({
        id,
        type: "retailerNode",
        position: { x: pipelineX + xGap, y: i * yGap },
        data: {
          brand,
          products: retailerData?.products ?? [],
          totalCount: retailerData?.totalCount ?? 0,
          nodeStatus,
          mobile,
        } satisfies RetailerData,
        draggable: false,
        selectable: false,
      });

      const isActive = nodeStatus !== "pending";
      edges.push({
        id: `preferences->${id}`,
        source: "preferences",
        target: id,
        type: "smoothstep",
        animated: nodeStatus === "working",
        style: {
          stroke: isActive ? `${ACCENT}80` : "var(--rf-edge-idle)",
          strokeWidth: isActive ? 2 : 1.5,
        },
      });
    });

    // Outfit
    const outfitW = mobile ? 240 : 310;
    const outfitStatus: "pending" | "working" | "done" =
      outfit ? "done" : stageIdx >= 2 ? "working" : "pending";

    if (stageIdx >= 1 || outfit) {
      nodes.push({
        id: "outfit",
        type: "outfitNode",
        position: { x: pipelineX + xGap * 2, y: retailerCenterY - 30 },
        data: { outfit, nodeStatus: outfitStatus, mobile, width: outfitW } satisfies OutfitData,
        draggable: false,
        selectable: false,
      });

      for (const rid of retailerIds) {
        const rData = retailers.get(rid.replace("retailer-", ""));
        const isActive = rData?.status === "done" || outfitStatus !== "pending";
        edges.push({
          id: `${rid}->outfit`,
          source: rid,
          target: "outfit",
          type: "smoothstep",
          animated: outfitStatus === "working",
          style: {
            stroke: isActive ? `${ACCENT}80` : "var(--rf-edge-idle)",
            strokeWidth: isActive ? 2 : 1.5,
          },
        });
      }
    }

    // Image
    const imageW = mobile ? 240 : 310;
    const imageStatus: "pending" | "working" | "done" =
      image ? "done" : stageIdx >= 3 ? "working" : "pending";

    if (stageIdx >= 2 || image) {
      nodes.push({
        id: "image",
        type: "imageNode",
        position: { x: pipelineX + xGap * 3, y: retailerCenterY - 10 },
        data: { image, nodeStatus: imageStatus, mobile, width: imageW } satisfies ImageData,
        draggable: false,
        selectable: false,
      });

      edges.push({
        id: "outfit->image",
        source: "outfit",
        target: "image",
        type: "smoothstep",
        animated: imageStatus === "working",
        style: {
          stroke: imageStatus !== "pending" ? `${ACCENT}80` : "var(--rf-edge-idle)",
          strokeWidth: imageStatus !== "pending" ? 2 : 1.5,
        },
      });
    }
  }

  return { nodes, edges };
}

// ── Auto-fit on graph changes ──────────────────────────

function AutoFit({ nodeCount, phase }: { nodeCount: number; phase: string }) {
  const { fitView } = useReactFlow();
  const prevCount = useRef(nodeCount);
  const prevPhase = useRef(phase);

  useEffect(() => {
    if (nodeCount !== prevCount.current || phase !== prevPhase.current) {
      prevCount.current = nodeCount;
      prevPhase.current = phase;
      const timer = setTimeout(() => {
        fitView({ padding: 0.08, duration: 350 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [nodeCount, phase, fitView]);

  return null;
}

// ── Main component ─────────────────────────────────────

export interface FashionUnifiedFlowProps {
  phase: "form" | "running" | "done";
  onSubmit: (context: FashionContext, message: string) => void;
  onClose: () => void;
  preferences?: FashionFlowProps["preferences"];
  retailers: FashionFlowProps["retailers"];
  outfit?: FashionFlowProps["outfit"];
  image?: FashionFlowProps["image"];
  currentStage: string;
}

function FlowInner(props: FashionUnifiedFlowProps) {
  const {
    phase, onSubmit, onClose,
    preferences, retailers, outfit, image, currentStage,
  } = props;

  const mobile = useIsMobile();
  const dotColor = useDotColor();
  const isPipeline = phase === "running" || phase === "done";

  // Form state
  const [formStep, setFormStep] = useState(0);
  const [formState, setFormState] = useState<FormState>(defaultFormState);

  // Reset form step when re-entering form phase
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (phase === "form" && prevPhase.current !== "form") {
      setFormStep(0);
    }
    prevPhase.current = phase;
  }, [phase]);

  const handleUpdate = useCallback((key: keyof FormState, value: string | number) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleBudgetPreset = useCallback((idx: number) => {
    setFormState((prev) => ({
      ...prev,
      budgetPreset: idx,
      ...(idx < 3 ? { budgetMin: BUDGET_PRESETS[idx].min, budgetMax: BUDGET_PRESETS[idx].max } : {}),
    }));
  }, []);

  const handleNext = useCallback(() => setFormStep((s) => Math.min(s + 1, 2)), []);
  const handleBack = useCallback(() => setFormStep((s) => Math.max(s - 1, 0)), []);

  const handleSubmit = useCallback(() => {
    const context: FashionContext = {
      budget: { min: formState.budgetMin, max: formState.budgetMax, currency: "USD" },
      style: formState.style,
      occasion: formState.occasion,
      ...(formState.gender && { gender: formState.gender }),
      ...(formState.bodyType && { bodyType: formState.bodyType }),
      ...(formState.colorPreferences && { colorPreferences: formState.colorPreferences }),
      ...(formState.photoUrl && { photoUrl: formState.photoUrl }),
    };
    const message = `Style me a ${formState.style} outfit for ${formState.occasion} within $${formState.budgetMin}-$${formState.budgetMax}${formState.colorPreferences ? `, preferring ${formState.colorPreferences} colors` : ""}`;
    onSubmit(context, message);
  }, [formState, onSubmit]);

  // Stable callbacks ref to avoid node data churn
  const callbacksRef = useRef({ onUpdate: handleUpdate, onBudgetPreset: handleBudgetPreset, onNext: handleNext, onBack: handleBack, onSubmit: handleSubmit });
  callbacksRef.current = { onUpdate: handleUpdate, onBudgetPreset: handleBudgetPreset, onNext: handleNext, onBack: handleBack, onSubmit: handleSubmit };

  const stableCallbacks = useMemo(() => ({
    onUpdate: ((key: keyof FormState, value: string | number) => callbacksRef.current.onUpdate(key, value)) as (key: keyof FormState, value: string | number) => void,
    onBudgetPreset: (idx: number) => callbacksRef.current.onBudgetPreset(idx),
    onNext: () => callbacksRef.current.onNext(),
    onBack: () => callbacksRef.current.onBack(),
    onSubmit: () => callbacksRef.current.onSubmit(),
  }), []);

  const { nodes, edges } = useMemo(
    () => buildUnifiedGraph({
      formStep,
      formState,
      isPipeline,
      preferences,
      retailers,
      outfit,
      image,
      currentStage,
      callbacks: stableCallbacks,
      mobile,
    }),
    [formStep, formState, isPipeline, preferences, retailers, outfit, image, currentStage, stableCallbacks, mobile],
  );

  return (
    <div className="w-full h-full rounded-[var(--radius-lg)] overflow-hidden border border-[var(--glass-border)] bg-[var(--flow-bg)] relative">
      {/* Close button (form phase only) */}
      {!isPipeline && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
          title="Cancel"
        >
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={unifiedNodeTypes}
        fitView
        fitViewOptions={{
          padding: mobile ? 0.05 : isPipeline ? 0.05 : 0.12,
          maxZoom: mobile ? 0.6 : isPipeline ? 0.85 : 1,
          minZoom: 0.1,
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        nodesFocusable={false}
        panOnDrag
        zoomOnScroll
        zoomOnDoubleClick
        zoomOnPinch
        preventScrolling={false}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={dotColor} />
        <AutoFit nodeCount={nodes.length} phase={phase} />
      </ReactFlow>
    </div>
  );
}

export function FashionUnifiedFlow(props: FashionUnifiedFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}
