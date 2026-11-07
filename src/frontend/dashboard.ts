// Gráficos del dashboard — Chart.js local, datos embebidos por el servidor.
// Donut de gastos, línea de ingresos/gastos en el tiempo y barras por persona.
// Cada gráfico es independiente: si falta su canvas o sus datos, se omite.

/** Mínimo de la API de Chart.js que usa este archivo (global cargada por <script>). */
interface ChartStatic {
  new (ctx: CanvasRenderingContext2D, config: Record<string, unknown>): unknown;
}
declare const Chart: ChartStatic | undefined;

interface DonutData {
  currency: string;
  labels: string[];
  values: number[];
  colors: string[];
}

interface SeriesData {
  currency: string;
  labels: string[];
  income: number[];
  expense: number[];
}

interface DonutTooltipCtx {
  label: string;
  parsed: number;
  dataset: { data: number[] };
}

interface SeriesTooltipCtx {
  label: string;
  parsed: { x?: number; y?: number };
  dataset: { data: number[] };
}

const readJson = <T>(id: string): T | null => {
  const el = document.getElementById(id);
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return null;
  }
};

const minorOf = (currency: string): number => (currency === 'USD' ? 2 : 0);

const fmtMoney = (minorAmount: number, currency: string): string => {
  const minor = minorOf(currency);
  const abs = Math.abs(minorAmount);
  const value = (abs / Math.pow(10, minor)).toLocaleString('es-CO', {
    minimumFractionDigits: minor,
    maximumFractionDigits: minor,
  });
  return (minorAmount < 0 ? '-$' : '$') + (currency === 'COP' ? ' ' : '') + value;
};

/** Callback de tooltip para gráficos de línea/barras (parsed.y = valor). */
const moneyTooltip = (currency: string) => (ctx: SeriesTooltipCtx) => {
  const value = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : (ctx.parsed.x ?? 0);
  return ' ' + ctx.label + ': ' + fmtMoney(value, currency);
};

const initDonut = () => {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('expenses-donut') as HTMLCanvasElement | null;
  if (!canvas) return;
  const data = readJson<DonutData>('dash-data');
  if (!data || !data.values || data.values.length === 0) return;

  new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [
        {
          data: data.values,
          backgroundColor: data.colors,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx: DonutTooltipCtx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.floor((ctx.parsed * 100) / total) : 0;
              return ' ' + ctx.label + ': ' + fmtMoney(ctx.parsed, data.currency) + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
};

const initTimeline = () => {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('timeline-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const data = readJson<SeriesData>('timeline-data');
  if (!data || !data.labels || data.labels.length === 0) return;

  new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Ingresos',
          data: data.income,
          borderColor: '#1f9d61',
          backgroundColor: 'rgba(31, 157, 97, 0.15)',
          fill: true,
          tension: 0.25,
          pointRadius: data.labels.length > 45 ? 0 : 2,
        },
        {
          label: 'Gastos',
          data: data.expense,
          borderColor: '#d64545',
          backgroundColor: 'rgba(214, 69, 69, 0.12)',
          fill: true,
          tension: 0.25,
          pointRadius: data.labels.length > 45 ? 0 : 2,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: moneyTooltip(data.currency) } },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v: number | string) => fmtMoney(Number(v), data.currency) },
        },
      },
    },
  });
};

const initMembers = () => {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('members-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const data = readJson<SeriesData>('members-data');
  if (!data || !data.labels || data.labels.length === 0) return;

  new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        { label: 'Ingresos', data: data.income, backgroundColor: '#1f9d61' },
        { label: 'Gastos', data: data.expense, backgroundColor: '#d64545' },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: moneyTooltip(data.currency) } },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v: number | string) => fmtMoney(Number(v), data.currency) },
        },
      },
    },
  });
};

initDonut();
initTimeline();
initMembers();
