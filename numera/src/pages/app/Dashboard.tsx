import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Smartphone,
  RefreshCw,
  Trash2,
  KeyRound,
  ChevronRight,
  Loader2,
  CircleDollarSign,
  Clock,
  Info,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { npApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { rs, countdown, classnames } from "../../lib/utils";
import type { NumberRequest } from "../../lib/types";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";

interface Service {
  name: string;
  count?: number;
  price?: number;
}
interface Country {
  name: string;
  count?: number;
}

export function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const holdMinutes = Number(settings.number_hold_minutes || 20);

  const [services, setServices] = useState<Service[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [service, setService] = useState("");
  const [country, setCountry] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [numbers, setNumbers] = useState<NumberRequest[]>([]);
  const [tick, setTick] = useState(0); // forces countdown re-render

  const servicePrice = (name: string): number => {
    const s = services.find((x) => x.name === name);
    return s?.price ?? Number(settings.price_per_number || 5);
  };

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const data = await npApi.services();
      const list: Service[] = (data.services || []).map((s: any) => ({
        name: s.name,
        count: s.count,
        price: s.price != null ? Number(s.price) : undefined,
      }));
      // Merge any per-service prices we stored
      const { data: prices } = await supabase.from("service_prices").select("*");
      const priceMap = new Map((prices || []).map((p: any) => [p.service, Number(p.price)]));
      setServices(
        list.map((s) => ({ ...s, price: priceMap.has(s.name) ? priceMap.get(s.name) : s.price ?? Number(settings.price_per_number || 5) }))
      );
    } catch {
      toast("Could not load services. Try again in a moment.", "error");
    } finally {
      setLoadingServices(false);
    }
  }, [settings.price_per_number, toast]);

  const loadNumbers = useCallback(async () => {
    const { data } = await supabase
      .from("number_requests")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(20);
    setNumbers((data as NumberRequest[]) || []);
  }, []);

  useEffect(() => {
    loadServices();
    loadNumbers();
  }, [loadServices, loadNumbers]);

  // Live countdown ticker
  useEffect(() => {
    const hasPending = numbers.some((n) => n.status === "pending" && n.expires_at);
    if (!hasPending) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [numbers]);

  // Auto-poll OTP for the most recent pending number
  useEffect(() => {
    const pending = numbers.find((n) => n.status === "pending");
    if (!pending) return;
    const i = setInterval(async () => {
      // Only auto-check if still within the hold window
      if (pending.expires_at && new Date(pending.expires_at).getTime() <= Date.now()) return;
      try {
        const res = await npApi.checkOtp(pending.id);
        if (res.otp) {
          toast(`OTP received: ${res.otp}`, "success");
          loadNumbers();
          refreshProfile();
        }
      } catch {
        /* ignore polling errors */
      }
    }, 10000);
    return () => clearInterval(i);
  }, [numbers, loadNumbers, refreshProfile, toast]);

  const onServiceChange = async (val: string) => {
    setService(val);
    setCountry("");
    setCountries([]);
    if (!val) return;
    setLoadingCountries(true);
    try {
      const data = await npApi.countries(val);
      setCountries(data.countries || []);
    } catch {
      toast("Could not load countries for that service.", "error");
    } finally {
      setLoadingCountries(false);
    }
  };

  const requestNumber = async () => {
    if (!service || !country) {
      toast("Please choose a service and a country.", "error");
      return;
    }
    setRequesting(true);
    try {
      await npApi.requestNumber(service, country);
      toast("Number requested — price is held until the OTP arrives.", "success");
      await Promise.all([loadNumbers(), refreshProfile()]);
      setService("");
      setCountry("");
      setCountries([]);
    } catch (e: any) {
      toast(e.message || "Could not request a number.", "error");
    } finally {
      setRequesting(false);
    }
  };

  const checkOtp = async (id: number) => {
    try {
      const res = await npApi.checkOtp(id);
      if (res.otp) {
        toast(`OTP received: ${res.otp}`, "success");
        await Promise.all([loadNumbers(), refreshProfile()]);
      } else if (res.expired) {
        toast("No OTP arrived in time — your balance was refunded.", "info");
        await Promise.all([loadNumbers(), refreshProfile()]);
      } else {
        toast("No OTP yet — try again in a few seconds.", "info");
      }
    } catch (e: any) {
      toast(e.message || "Could not check OTP.", "error");
    }
  };

  const release = async (id: number) => {
    if (!confirm("Release this number?")) return;
    try {
      await npApi.releaseNumber(id);
      toast("Number released.", "success");
      await Promise.all([loadNumbers(), refreshProfile()]);
    } catch (e: any) {
      toast(e.message || "Could not release number.", "error");
    }
  };

  const available = (profile?.wallet_balance ?? 0) - (profile?.wallet_hold ?? 0);
  const active = numbers.filter((n) => n.status === "active" || n.status === "pending");

  return (
    <div>
      <PageHeader
        title="Get a number"
        subtitle={
          <span>
            Balance <strong className="text-brand-400">{rs(profile?.wallet_balance)}</strong>
            {" · "}available <strong style={{ color: "var(--fg)" }}>{rs(available)}</strong>
            {profile && profile.wallet_hold > 0 && (
              <span style={{ color: "var(--fg-dim)" }}> ({rs(profile.wallet_hold)} held)</span>
            )}
          </span>
        }
      />

      {settings.country_status && (
        <div className="card p-4 mb-6 flex items-start gap-3" style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}>
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{settings.country_status}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5 mb-9">
        {/* Request form */}
        <div className="card p-6 lg:col-span-3">
          <div className="flex items-center gap-2 mb-5">
            <Smartphone className="w-5 h-5 text-brand-400" />
            <h3 className="font-display font-bold text-lg" style={{ color: "var(--fg)" }}>Request a virtual number</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Service</label>
              <select
                className="input"
                value={service}
                onChange={(e) => onServiceChange(e.target.value)}
                disabled={loadingServices || requesting}
              >
                <option value="">{loadingServices ? "Loading…" : "Select a service"}</option>
                {services.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} — {rs(s.price ?? servicePrice(s.name))} ({s.count ?? 0} avail.)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Country</label>
              <select
                className="input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={!service || loadingCountries || requesting}
              >
                <option value="">
                  {!service ? "Select a service first" : loadingCountries ? "Loading…" : "Select a country"}
                </option>
                {countries.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.count ?? 0} avail.)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button onClick={requestNumber} disabled={requesting} className="btn btn-primary w-full mt-5">
            {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            {requesting ? "Requesting…" : `Request number ${service ? `· ${rs(servicePrice(service))}` : ""}`}
          </button>

          {available < servicePrice(service) && service && (
            <p className="text-xs mt-3 text-amber-400">
              Insufficient available balance for this service — top up your wallet first.
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <CircleDollarSign className="w-5 h-5 text-brand-400" />
            <h3 className="font-display font-bold text-lg" style={{ color: "var(--fg)" }}>How it works</h3>
          </div>
          <ul className="space-y-3 text-sm" style={{ color: "var(--fg-muted)" }}>
            <li className="flex gap-3"><span className="text-brand-400 font-bold">1.</span> Pick a service &amp; country.</li>
            <li className="flex gap-3"><span className="text-brand-400 font-bold">2.</span> Get a live number instantly — the price is <em>held</em>, not charged.</li>
            <li className="flex gap-3"><span className="text-brand-400 font-bold">3.</span> Send it for verification, then check for the OTP below.</li>
            <li className="flex gap-3"><span className="text-brand-400 font-bold">4.</span> Charged only once the OTP arrives — no OTP in {holdMinutes} min = full refund.</li>
          </ul>
        </div>
      </div>

      {/* Active numbers */}
      <h2 className="font-display font-bold text-xl mb-4" style={{ color: "var(--fg)" }}>Your numbers</h2>

      {active.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Smartphone className="w-6 h-6 text-brand-400" />}
            title="No active numbers yet"
            description="Choose a service and country above to request your first number."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((n, idx) => {
            const time = countdown(n.expires_at);
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono font-bold text-lg" style={{ color: "var(--fg)" }}>{n.number}</span>
                      <span className={classnames("badge", n.status === "active" ? "badge-active" : "badge-pending")}>
                        {n.status === "active" ? "OTP received" : "Waiting for OTP"}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                      {n.service} · {n.country} · {rs(n.cost)}
                    </p>
                    {n.otp_code && (
                      <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(52,211,153,0.1)" }}>
                        <KeyRound className="w-4 h-4 text-brand-400" />
                        <span className="font-mono font-bold text-brand-400 tracking-widest">{n.otp_code}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {n.status === "pending" && time && (
                      <div className="flex items-center gap-1.5 text-sm font-mono" style={{ color: "var(--fg-muted)" }}>
                        <Clock className="w-4 h-4" /> {time}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {n.status === "pending" && (
                        <button onClick={() => checkOtp(n.id)} className="btn btn-outline btn-sm">
                          <RefreshCw className="w-3.5 h-3.5" /> Check OTP
                        </button>
                      )}
                      <button onClick={() => release(n.id)} className="btn btn-danger btn-sm">
                        <Trash2 className="w-3.5 h-3.5" /> Release
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {/* hidden ref to use tick */}
      <span className="hidden">{tick}</span>
    </div>
  );
}
