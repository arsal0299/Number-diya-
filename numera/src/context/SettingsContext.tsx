import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { settingsApi } from "../lib/api";
import type { PublicSettings } from "../lib/types";

const DEFAULTS: PublicSettings = {
  site_name: "Numera",
  price_per_number: "5.00",
  min_topup_amount: "50",
  number_hold_minutes: "20",
  country_status: "",
  contact_email: "",
  site_logo_url: "",
  payment_method_name: "Bank Transfer",
  payment_bank_name: "",
  payment_account_title: "",
  payment_account_number: "",
  payment_instructions: "",
};

interface SettingsState {
  settings: PublicSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsState>({
  settings: DEFAULTS,
  loading: true,
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await settingsApi.public();
      setSettings({ ...DEFAULTS, ...(data.settings as PublicSettings) });
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
