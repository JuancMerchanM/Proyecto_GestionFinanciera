// Donut de gastos por categoría — Chart.js local, datos embebidos por el servidor.
(function () {
  var canvas = document.getElementById('expenses-donut');
  if (!canvas || typeof Chart === 'undefined') return;

  var el = document.getElementById('dash-data');
  if (!el) return;
  var data;
  try {
    data = JSON.parse(el.textContent);
  } catch (e) {
    return;
  }
  if (!data || !data.values || data.values.length === 0) return;

  var minor = data.currency === 'USD' ? 2 : 0;

  function fmtMoney(minorAmount) {
    var abs = Math.abs(minorAmount);
    var value = (abs / Math.pow(10, minor)).toLocaleString('es-CO', {
      minimumFractionDigits: minor,
      maximumFractionDigits: minor,
    });
    return (minorAmount < 0 ? '-$' : '$') + (data.currency === 'COP' ? ' ' : '') + value;
  }

  new Chart(canvas.getContext('2d'), {
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
            label: function (ctx) {
              var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
              var pct = total > 0 ? Math.floor((ctx.parsed * 100) / total) : 0;
              return ' ' + ctx.label + ': ' + fmtMoney(ctx.parsed) + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
})();
