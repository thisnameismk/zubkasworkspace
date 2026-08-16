import type { ReactNode } from 'react';
import { formatINR, formatDate } from '@/lib/calc';
import type { Client, LineItem, TaxType } from '@/lib/types';
import { useSettings, type CompanyProfile, type AppSettings, type PaymentAccount, getAccentHex } from '@/lib/settings';
import { cn } from '@/lib/utils';

function CompanyLogo({ company, accent }: { company: CompanyProfile; accent: string }) {
  if (company.logo) {
    return (
      <img
        src={company.logo}
        alt={company.name}
        className="h-14 w-auto max-w-[180px] object-contain"
        crossOrigin="anonymous"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-xl shrink-0"
      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
    >
      {company.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function DocHeader({
  title,
  docNumber,
  accent,
}: {
  title: string;
  docNumber: string;
  accent: string;
}) {
  const { settings } = useSettings();
  const company = settings.company;
  return (
    <div className="flex items-start justify-between pb-5 mb-5 border-b-2" style={{ borderColor: accent }}>
      <div className="flex items-start gap-3">
        <CompanyLogo company={company} accent={accent} />
        <div>
          <p className="font-bold text-lg leading-tight" style={{ color: accent }}>{company.name}</p>
          <div className="text-[11px] text-gray-500 mt-1 space-y-0.5 leading-tight">
            {company.address && <p className="max-w-[220px]">{company.address}</p>}
            {company.email && <p>{company.email}</p>}
            {company.website && <p>{company.website}</p>}
            {company.phone && <p>Ph: {company.phone}</p>}
            {company.gstin && <p className="font-medium text-gray-600">GSTIN: {company.gstin}</p>}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-2xl font-bold tracking-tight" style={{ color: accent }}>{title}</p>
        <p className="text-sm font-semibold mt-1 text-gray-700">{docNumber}</p>
      </div>
    </div>
  );
}

export function DocClientBox({
  label,
  client,
  accent,
}: {
  label: string;
  client?: Client;
  accent: string;
}) {
  if (!client) return null;
  return (
    <div className="rounded-lg border border-gray-200 p-3.5 bg-gray-50/50">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: accent }}>{label}</p>
      <p className="font-semibold text-sm text-gray-800">{client.company_name}</p>
      {client.contact_person && <p className="text-xs text-gray-600">{client.contact_person}</p>}
      {client.address && <p className="text-xs text-gray-500 mt-0.5 max-w-[240px]">{client.address}</p>}
      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
        {client.email && <p>{client.email}</p>}
        {client.phone && <p>{client.phone}</p>}
        {client.gstin && <p className="font-mono">GSTIN: {client.gstin}</p>}
      </div>
    </div>
  );
}

export function DocMetaBox({ rows, accent }: { rows: { label: string; value: string }[]; accent: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3.5 bg-gray-50/50 text-right">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-4 text-xs mb-1 last:mb-0">
          <span className="text-gray-500">{r.label}</span>
          <span className="font-semibold text-gray-700">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DocItemsTable({ items, accent }: { items: LineItem[]; accent: string }) {
  return (
    <table className="w-full text-sm border-collapse mb-5">
      <thead>
        <tr style={{ background: `${accent}15`, borderBottom: `2px solid ${accent}` }}>
          <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">#</th>
          <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">Description</th>
          <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">Qty</th>
          <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">Unit Price</th>
          <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.filter((it) => it.description.trim()).map((it, i) => (
          <tr key={i} className="border-b border-gray-100">
            <td className="py-2.5 px-3 text-gray-400 text-xs">{i + 1}</td>
            <td className="py-2.5 px-3 text-gray-800">{it.description}</td>
            <td className="py-2.5 px-3 text-right text-gray-600">{it.quantity}</td>
            <td className="py-2.5 px-3 text-right text-gray-600">{formatINR(Number(it.rate))}</td>
            <td className="py-2.5 px-3 text-right font-semibold text-gray-800">{formatINR(Number(it.amount))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocTotals({
  rows,
  total,
  accent,
  statusStamp,
}: {
  rows: { label: string; value: string }[];
  total: string;
  accent: string;
  statusStamp?: { label: string; color: string };
}) {
  return (
    <div className="flex justify-end mb-5">
      <div className="w-full max-w-xs">
        <div className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between text-gray-600">
              <span>{r.label}</span>
              <span className="font-medium">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2.5 flex justify-between items-center rounded-lg px-3 py-2.5" style={{ background: `${accent}10`, borderTop: `2px solid ${accent}` }}>
          <span className="font-bold text-gray-800">Total Amount</span>
          <span className="text-xl font-bold" style={{ color: accent }}>{total}</span>
        </div>
        {statusStamp && (
          <div className="mt-3 flex justify-end">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ background: `${statusStamp.color}15`, color: statusStamp.color, border: `1px solid ${statusStamp.color}40` }}
            >
              {statusStamp.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocFooter({
  accent,
  notes,
  paymentAccount,
  terms,
}: {
  accent: string;
  notes?: string;
  paymentAccount?: PaymentAccount | null;
  terms?: string[] | null;
}) {
  const { settings } = useSettings();
  const c = settings.company;
  const termsList = terms && terms.length > 0 ? terms : settings.defaultTerms;

  return (
    <div className="mt-6 pt-4 border-t-2" style={{ borderColor: `${accent}30` }}>
      <div className="grid grid-cols-2 gap-6">
        {/* Terms */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: accent }}>Terms &amp; Conditions</p>
          <ol className="text-[10px] text-gray-500 space-y-0.5 list-decimal pl-3 leading-relaxed">
            {termsList.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
            {notes && <li className="list-none font-medium text-gray-600 mt-1">Note: {notes}</li>}
          </ol>
        </div>
        {/* Payment details */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: accent }}>
            Payment Details{paymentAccount ? ` — ${paymentAccount.label}` : ''}
          </p>
          {paymentAccount ? (
            <div className="text-[10px] text-gray-500 space-y-0.5 leading-relaxed">
              {paymentAccount.upiId && <p><span className="font-medium text-gray-600">UPI ID:</span> {paymentAccount.upiId}</p>}
              {paymentAccount.bankName && <p><span className="font-medium text-gray-600">Bank:</span> {paymentAccount.bankName}</p>}
              {paymentAccount.accountName && <p><span className="font-medium text-gray-600">Name:</span> {paymentAccount.accountName}</p>}
              {paymentAccount.accountNumber && <p><span className="font-medium text-gray-600">A/C:</span> {paymentAccount.accountNumber}</p>}
              {paymentAccount.ifsc && <p><span className="font-medium text-gray-600">IFSC:</span> {paymentAccount.ifsc}</p>}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 italic">No payment account selected</p>
          )}
        </div>
      </div>

      {/* Signatory */}
      <div className="flex justify-end mt-6">
        <div className="text-center">
          <div className="w-44 h-12 border-b border-gray-300 flex items-end justify-center pb-1">
            <span className="text-[10px] text-gray-400 italic">Authorized Signatory</span>
          </div>
          <p className="text-xs font-semibold mt-1 text-gray-700">{c.name}</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          This is a computer-generated document &nbsp;|&nbsp; Powered by Zubkas Technology Private Limited &nbsp;|&nbsp; www.zubkas.com
        </p>
      </div>
    </div>
  );
}

export function useAccent() {
  const { settings } = useSettings();
  return getAccentHex(settings.accent, settings.customAccent);
}

export function useCompany() {
  const { settings } = useSettings();
  return settings.company;
}
