import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Radio, Globe2, Grid2x2, Loader2, RefreshCw } from "lucide-react";
import { otpFeedApi } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";

interface FeedRow {
  number: string;
  otp: string;
  service: string;
  country: string;
  time: string;
}
interface TrafficRow {
  service: string;
  country: string;
  percent: number;
}
interface FeedData {
  feed: FeedRow[];
  stats: { regions: number; services: number };
  topTraffic: TrafficRow[];
  hourly: number[];
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function LiveOtp() {
  const { toast } = useToast();
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await otpFeedApi.get();
      setData(res);
    } catch (e: any) {
      if (!silent) toast(e.message || "Could not load live feed.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const maxHourly = Math.max(1, ...(data?.hourly || [1]));

  return (
    <div>
      <PageHeader title="Live OTP feed" subtitle="Real-time codes landing on numbers across the platform." />

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe2 className="w-4 h-4 text-brand-400" />
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--fg-dim)" }}>OTP Regions</p>
          </div>
          <p className="font-display font-bold text-2xl" style={{ color: "var(--fg)" }}>{data?.stats.regions ?? "—"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Grid2x2 className="w-4 h-4 text-brand-400" />
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--fg-dim)" }}>Supported Services</p>
          </div>
          <p className="font-display font-bold text-2xl" style={{ color: "var(--fg)" }}>{data?.stats.services ?? "—"}</p>
        </div>
      </div>

      {/* Live feed */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-400 animate-pulse" />
            <h3 className="font-display font-bold text-lg" style={{ color: "var(--fg)" }}>Live OTP History</h3>
          </div>
          <button onClick={() => load()} className="btn btn-ghost btn-sm">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>

        {loading && !data ? (
          <div className="py-16 grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          </div>
        ) : !data || data.feed.length === 0 ? (
          <EmptyState icon={<Radio className="w-6 h-6 text-brand-400" />} title="No OTPs yet" description="Live codes will appear here as they arrive." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--fg-dim)" }} className="text-left text-xs uppercase tracking-wider">
                  <th className="pb-2 font-semibold">Number</th>
                  <th className="pb-2 font-semibold">OTP Code</th>
                  <th className="pb-2 font-semibold">Service</th>
                  <th className="pb-2 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {data.feed.map((row, i) => (
                    <motion.tr
                      key={`${row.number}-${row.time}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                    >
                      <td className="py-2.5">
                        <p className="font-mono" style={{ color: "var(--fg)" }}>{row.number}</p>
                        <p className="text-xs" style={{ color: "var(--fg-dim)" }}>{row.country}</p>
                      </td>
                      <td className="py-2.5 pr-2">
                        <span
                          className="inline-block px-2 py-1 rounded-lg font-mono text-xs"
                          style={{ background: "rgba(52,211,153,0.12)", color: "var(--color-brand-400)" }}
                        >
                          {row.otp}
                        </span>
                      </td>
                      <td className="py-2.5" style={{ color: "var(--fg-muted)" }}>{row.service}</td>
                      <td className="py-2.5 text-right text-xs" style={{ color: "var(--fg-dim)" }}>{timeAgo(row.time)}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top traffic */}
      <div className="card p-6 mb-6">
        <h3 className="font-display font-bold text-lg mb-4" style={{ color: "var(--fg)" }}>Top Traffic in 30 minutes</h3>
        {!data || data.topTraffic.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--fg-dim)" }}>No activity in the last 30 minutes.</p>
        ) : (
          <div className="space-y-2">
            {data.topTraffic.map((t, i) => (
              <div
                key={`${t.service}-${t.country}-${i}`}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: "var(--fg)" }}>{t.service}</p>
                  <p className="text-xs" style={{ color: "var(--fg-dim)" }}>{t.country}</p>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(52,211,153,0.15)", color: "var(--color-brand-400)" }}
                >
                  {t.percent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hourly volume */}
      <div className="card p-6">
        <h3 className="font-display font-bold text-lg mb-4" style={{ color: "var(--fg)" }}>OTP volume — last 6 hours</h3>
        <div className="flex items-end gap-3 h-32">
          {(data?.hourly || [0, 0, 0, 0, 0, 0]).map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(4, (v / maxHourly) * 100)}%`,
                  background: "var(--color-brand-400)",
                  opacity: 0.4 + (v / maxHourly) * 0.6,
                }}
              />
              <span className="text-xs" style={{ color: "var(--fg-dim)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
