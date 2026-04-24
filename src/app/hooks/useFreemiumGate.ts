import { useState } from "react";
import { apiCall } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useFreemiumGate() {
  const { user, refreshProfile } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const isPro = user?.plan === "pro" || user?.subscription === "pro" || user?.subscription === "premium";
  const freeGenerationUsed = user?.free_generation_used === true;

  const openUpgrade = () => setUpgradeOpen(true);
  const closeUpgrade = () => setUpgradeOpen(false);

  const ensureGenerationAccess = async () => {
    if (isPro) return true;
    if (freeGenerationUsed) {
      openUpgrade();
      return false;
    }

    try {
      const response = await apiCall("/entitlements/status");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.canGenerate === false) {
        await refreshProfile();
        openUpgrade();
        return false;
      }
      return true;
    } catch {
      openUpgrade();
      return false;
    }
  };

  const consumeGeneration = async (module: string) => {
    if (isPro) return true;

    const response = await apiCall("/entitlements/consume-generation", {
      method: "POST",
      body: JSON.stringify({ module }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.upgradeRequired) {
      await refreshProfile();
      openUpgrade();
      return false;
    }

    await refreshProfile();
    return true;
  };

  const handleGenerationResponse = async (response: Response) => {
    if (response.status === 402) {
      await refreshProfile();
      openUpgrade();
      return true;
    }
    return false;
  };

  return {
    isPro,
    freeGenerationUsed,
    upgradeOpen,
    openUpgrade,
    closeUpgrade,
    refreshProfile,
    ensureGenerationAccess,
    consumeGeneration,
    handleGenerationResponse,
  };
}
