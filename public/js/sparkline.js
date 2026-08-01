/** CoinGecko-style 7-day mini chart (inline SVG). */
export function renderSparkline(prices, changePct) {
  if (!prices?.length) {
    return '<span class="sparkline-empty">—</span>';
  }

  const w = 140;
  const h = 48;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 3;

  const points = prices
    .map((p, i) => {
      const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const up =
    changePct != null && !Number.isNaN(changePct)
      ? changePct >= 0
      : prices[prices.length - 1] >= prices[0];

  const stroke = up ? '#16c784' : '#ea3943';
  const fill = up ? 'rgba(22, 199, 132, 0.12)' : 'rgba(234, 57, 67, 0.12)';

  const areaPoints = `${pad},${h - pad} ${points} ${w - pad},${h - pad}`;

  return `
    <svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polygon class="sparkline-fill" points="${areaPoints}" fill="${fill}" />
      <polyline class="sparkline-line" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" points="${points}" />
    </svg>`;
}

export function get7dChange(coin) {
  return coin.price_change_percentage_7d_in_currency ?? coin.price_change_percentage_7d ?? null;
}

export function getSparklinePrices(coin) {
  return coin.sparkline_in_7d?.price || null;
}
