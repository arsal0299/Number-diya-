import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Settings as SettingsIcon, Image, CreditCard, Tag, KeyRound, Save, Loader2, Trash2, Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { adminApi } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { rs } from "../../lib/utils";
import type { ServicePrice } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function AdminSettings() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"site" | "branding" | "payment" | "pricing" | "password">("site");

  const [site, setSite] = useState({
    site_name: "", np_api_key: "", np_base_url: "https://numberpanel.tech", price_per_number: "5.00",
    number_hold_minutes: "20", country_status: "", contact_email: "", min_topup_amount: "50",
  });
  const [payment, setPayment] = useState({
    payment_method_name: "Bank Transfer", payment_bank_name: "", payment_account_title: "",
    payment_account_number: "", payment_instructions: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [currentLogo, setCurrentLogo] = useState("");
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [newPrice, setNewPrice] = useState({ service: "", price: "" });
  const [pwd, setPwd] = useState({ current: "", next: "" });
  const [saving, setSaving] = useState("");

  const loadAll = async () => {
    const { data } = await supabase.from("settings").select("*");
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => (map[r.key] = r.value));
    setSite((s) => ({
      ...s,
      site_name: map.site_name ?? s.site_name,
      np_api_key: map.np_api_key ?? "",
      np_base_url: map.np_base_url ?? s.np_base_url,
      price_per_number: map.price_per_number ?? s.price_per_number,
      number_hold_minutes: map.number_hold_minutes ?? s.number_hold_minutes,
      country_status: map.country_status ?? "",
      contact_email: map.contact_email ?? "",
      min_topup_amount: map.min_topup_amount ?? s.min_topup_amount,
    }));
    setPayment((p) => ({
      ...p,
      payment_method_name: map.payment_method_name ?? p.payment_method_name,
      payment_bank_name: map.payment_bank_name ?? "",
      payment_account_title: map.payment_account_title ?? "",
      payment_account_number: map.payment_account_number ?? "",
      payment_instructions: map.payment_instructions ?? "",
    }));
    setLogoUrl(map.site_logo_url ?? "");
    setCurrentLogo(map.site_logo_url ?? "");

    const { data: sp } = await supabase.from("service_prices").select("*").order("service");
    setPrices((sp as ServicePrice[]) || []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveSite = async () => {
    setSaving("site");
    try {
      await adminApi.saveSettings(site);
      toast("Settings saved.", "success");
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(""); }
  };
  const savePayment = async () => {
    setSaving("payment");
    try {
      await adminApi.savePaymentDetails(payment);
      toast("Payment details saved.", "success");
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(""); }
  };
  const saveBranding = async () => {
    setSaving("branding");
    try {
      await adminApi.saveBranding(logoUrl);
      setCurrentLogo(logoUrl);
      toast("Branding saved.", "success");
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(""); }
  };
  const addPrice = async () => {
    if (!newPrice.service || !newPrice.price) return;
    setSaving("pricing");
    try {
      await adminApi.saveServicePrice(newPrice.service, Number(newPrice.price));
      setNewPrice({ service: "", price: "" });
      await loadAll();
      toast("Price saved.", "success");
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(""); }
  };
  const delPrice = async (service: string) => {
    if (!confirm(`Delete price for ${service}?`)) return;
    try {
      await adminApi.deleteServicePrice(service);
      await loadAll();
      toast("Price removed.", "success");
    } catch (e: any) { toast(e.message, "error"); }
  };
  const changePwd = async () => {
    setSaving("password");
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) throw error;
      toast("Password changed.", "success");
      setPwd({ current: "", next: "" });
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(""); }
  };

  const TABS = [
    { id: "site", label: "Site & API", icon: SettingsIcon },
    { id: "branding", label: "Branding", icon: Image },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "pricing", label: "Pricing", icon: Tag },
    { id: "password", label: "Password", icon: KeyRound },
  ] as const;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your platform, branding, payments and pricing." />

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn btn-sm whitespace-nowrap ${tab === t.id ? "btn-primary" : "btn-ghost"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        {tab === "site" && (
          <div className="card p-6 space-y-4">
            <Field label="Site name"><input className="input" value={site.site_name} onChange={(e) => setSite({ ...site, site_name: e.target.value })} /></Field>
            <Field label="Number Panel API key"><input className="input font-mono" value={site.np_api_key} onChange={(e) => setSite({ ...site, np_api_key: e.target.value })} placeholder="Stored server-side only" /></Field>
            <Field label="Number Panel base URL"><input className="input" value={site.np_base_url} onChange={(e) => setSite({ ...site, np_base_url: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Default price / number (Rs)"><input type="number" step="0.01" className="input" value={site.price_per_number} onChange={(e) => setSite({ ...site, price_per_number: e.target.value })} /></Field>
              <Field label="Hold time (minutes)"><input type="number" min="1" className="input" value={site.number_hold_minutes} onChange={(e) => setSite({ ...site, number_hold_minutes: e.target.value })} /></Field>
            </div>
            <Field label="Minimum top-up (Rs)"><input type="number" min="0" className="input" value={site.min_topup_amount} onChange={(e) => setSite({ ...site, min_topup_amount: e.target.value })} /></Field>
            <Field label="Country / service status banner"><input className="input" value={site.country_status} onChange={(e) => setSite({ ...site, country_status: e.target.value })} placeholder="Shown to users on the dashboard" /></Field>
            <Field label="Support contact email"><input type="email" className="input" value={site.contact_email} onChange={(e) => setSite({ ...site, contact_email: e.target.value })} /></Field>
            <button onClick={saveSite} disabled={saving === "site"} className="btn btn-primary"><Save className="w-4 h-4" /> {saving === "site" ? "Saving…" : "Save settings"}</button>
          </div>
        )}

        {tab === "branding" && (
          <div className="card p-6 space-y-4">
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Paste a logo URL. Wherever the site name appears, this logo shows instead.</p>
            {currentLogo && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--panel)" }}>
                <img src={currentLogo} alt="Logo" className="h-8 w-auto" />
                <span className="text-xs" style={{ color: "var(--fg-dim)" }}>Current logo</span>
              </div>
            )}
            <Field label="Logo URL"><input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" /></Field>
            <button onClick={saveBranding} disabled={saving === "branding"} className="btn btn-primary"><Save className="w-4 h-4" /> {saving === "branding" ? "Saving…" : "Save branding"}</button>
          </div>
        )}

        {tab === "payment" && (
          <div className="card p-6 space-y-4">
            <Field label="Method name"><input className="input" value={payment.payment_method_name} onChange={(e) => setPayment({ ...payment, payment_method_name: e.target.value })} placeholder="JazzCash / Easypaisa / Bank Transfer" /></Field>
            <Field label="Bank / provider name"><input className="input" value={payment.payment_bank_name} onChange={(e) => setPayment({ ...payment, payment_bank_name: e.target.value })} /></Field>
            <Field label="Account title"><input className="input" value={payment.payment_account_title} onChange={(e) => setPayment({ ...payment, payment_account_title: e.target.value })} /></Field>
            <Field label="Account number"><input className="input font-mono" value={payment.payment_account_number} onChange={(e) => setPayment({ ...payment, payment_account_number: e.target.value })} /></Field>
            <Field label="Instructions"><input className="input" value={payment.payment_instructions} onChange={(e) => setPayment({ ...payment, payment_instructions: e.target.value })} /></Field>
            <button onClick={savePayment} disabled={saving === "payment"} className="btn btn-primary"><Save className="w-4 h-4" /> {saving === "payment" ? "Saving…" : "Save payment details"}</button>
          </div>
        )}

        {tab === "pricing" && (
          <div className="card p-6 space-y-5">
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Override the default price for a specific service.</p>
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-[140px]"><Field label="Service"><input className="input" value={newPrice.service} onChange={(e) => setNewPrice({ ...newPrice, service: e.target.value })} placeholder="e.g. WhatsApp" /></Field></div>
              <div className="w-28"><Field label="Price (Rs)"><input type="number" step="0.01" className="input" value={newPrice.price} onChange={(e) => setNewPrice({ ...newPrice, price: e.target.value })} /></Field></div>
              <button onClick={addPrice} disabled={saving === "pricing"} className="btn btn-primary"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {prices.map((p) => (
                <div key={p.service} className="flex items-center justify-between py-2.5">
                  <span className="font-medium" style={{ color: "var(--fg)" }}>{p.service}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-brand-400">{rs(p.price)}</span>
                    <button onClick={() => delPrice(p.service)} className="opacity-60 hover:opacity-100"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              ))}
              {prices.length === 0 && <p className="text-sm py-2" style={{ color: "var(--fg-dim)" }}>No custom prices — using default for all services.</p>}
            </div>
          </div>
        )}

        {tab === "password" && (
          <div className="card p-6 space-y-4">
            <Field label="New password"><input type="password" minLength={8} className="input" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="At least 8 characters" /></Field>
            <button onClick={changePwd} disabled={saving === "password" || pwd.next.length < 8} className="btn btn-primary">
              {saving === "password" ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Change password
            </button>
            <p className="text-xs" style={{ color: "var(--fg-dim)" }}>This changes your own login password. Authenticated through Supabase Auth.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
