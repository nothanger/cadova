
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle } from "lucide-react";
import { CadovaLogo } from "./CadovaLogo";

interface LoadingStep {
  label: string;
  duration: number; // ms
}

interface LoadingScreenProps {
  steps: LoadingStep[];
  accent?: string;
  label: string;
  onComplete: () => void;
}

export function LoadingScreen({
  steps,
  accent = "#5548F5",
  label,
  onComplete,
}: LoadingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [globalProgress, setGlobalProgress] = useState(0);

  useEffect(() => {
    let stepIdx = 0;
    const totalDuration = steps.reduce((acc, s) => acc + s.duration, 0);
    let elapsed = 0;

    const runStep = () => {
      if (stepIdx >= steps.length) {
        setGlobalProgress(100);
        setTimeout(onComplete, 300);
        return;
      }

      setCurrentStep(stepIdx);
      const duration = steps[stepIdx].duration;

      
      const startElapsed = elapsed;
      const startTime = Date.now();
      const tick = () => {
        const stepElapsed = Date.now() - startTime;
        const pct = ((startElapsed + stepElapsed) / totalDuration) * 100;
        setGlobalProgress(Math.min(pct, 100));
        if (stepElapsed < duration) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, stepIdx]);
        elapsed += duration;
        stepIdx++;
        runStep();
      }, duration);
    };

    runStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "#0A0914" }}
    >
      
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: `${accent}22` }}
      />

      <div className="relative w-full max-w-sm mx-auto px-8 flex flex-col items-center gap-10">

        
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <CadovaLogo size="md" />
          </motion.div>
          <p
            className="text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.62)" }}
          >
            {label}
          </p>
        </div>

        {/* Steps list */}
        <div className="w-full space-y-3">
          {steps.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = currentStep === i && !isDone;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-3"
              >
                
                <div className="flex-shrink-0 size-5 flex items-center justify-center">
                  {isDone ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <CheckCircle
                        className="size-4"
                        style={{ color: accent }}
                      />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="size-2 rounded-full"
                      style={{ background: accent }}
                    />
                  ) : (
                    <div
                      className="size-2 rounded-full"
                      style={{ background: "rgba(255,255,255,0.12)" }}
                    />
                  )}
                </div>

                
                <span
                  className="text-[13px] transition-all duration-300"
                  style={{
                    color: isDone
                      ? "rgba(255,255,255,0.7)"
                      : isActive
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(255,255,255,0.62)",
                    fontFamily: "DM Sans, system-ui, sans-serif",
                  }}
                >
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        
        <div className="w-full">
          <div
            className="h-px rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${globalProgress}%`,
                background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span
              className="text-[10px] tabular-nums"
              style={{ color: "rgba(255,255,255,0.18)", fontFamily: "ui-monospace, monospace" }}
            >
              {Math.round(globalProgress)}%
            </span>
            <span
              className="text-[10px] tabular-nums"
              style={{ color: "rgba(255,255,255,0.18)", fontFamily: "ui-monospace, monospace" }}
            >
              cadova.fr
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
