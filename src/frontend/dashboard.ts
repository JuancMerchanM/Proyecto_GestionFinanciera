// Donut de gastos por categoría — Chart.js local, datos embebidos por el servidor.

/** Mínimo de la API de Chart.js que usa este archivo (global cargada por <script>). */
interface ChartStatic {
  new (ctx: CanvasRenderingContext2D, config: Record<string, unknown>): unknown;
}
declare const Chart: ChartStatic | undefined;

interface DashData {
  currency: string;
  labels: string[];
  values: number[];
  colors: string[];
}

interface TooltipCtx {
  label: string;
  parsed: number;
  dataset: { data: number[] };
}

(() => {
  const canvas = document.getElementById('expenses-donut') as HTMLCanvasElement | null;
  if (!canvas || typeof Chart === 'undefined') return;

  const el = document.getElementById('dash-data');
  if (!el) return;
  let data: DashData;
  try {
    data = JSON.parse(el.textContent as string) as DashData;
  } catch {
    return;
  }
  if (!data || !data.values || data.values.length === 0) return;

  const minor = data.currency === 'USD' ? 2 : 0;

  function fmtMoney(minorAmount: number): string {
    const abs = Math.abs(minorAmount);
    const value = (abs / Math.pow(10, minor)).toLocaleString('es-CO', {
      minimumFractionDigits: minor,
      maximumFractionDigits: minor,
    });
    return (minorAmount < 0 ? '-$' : '$') + (data.currency === 'COP' ? ' ' : '') + value;
  }

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
            label: function (ctx: TooltipCtx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.floor((ctx.parsed * 100) / total) : 0;
              return ' ' + ctx.label + ': ' + fmtMoney(ctx.parsed) + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
})();
