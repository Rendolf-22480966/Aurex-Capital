export function formatUsd(n, compact = false) {
  if (n == null || Number.isNaN(n)) return '—';
  if (compact && Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (compact && Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (compact && Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (compact && Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  }).format(n);
}

export function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatNumber(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatSupply(n) {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return formatNumber(n, 0);
}

export function pctClass(n) {
  if (n == null) return '';
  return n >= 0 ? 'positive' : 'negative';
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
