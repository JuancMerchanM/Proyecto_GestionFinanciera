"use strict";
(() => {
  const canvas = document.getElementById("expenses-donut");
  if (!canvas || typeof Chart === "undefined") return;
  const el = document.getElementById("dash-data");
  if (!el) return;
  let data;
  try {
    data = JSON.parse(el.textContent);
  } catch {
    return;
  }
  if (!data || !data.values || data.values.length === 0) return;
  const minor = data.currency === "USD" ? 2 : 0;
  function fmtMoney(minorAmount) {
    const abs = Math.abs(minorAmount);
    const value = (abs / Math.pow(10, minor)).toLocaleString("es-CO", {
      minimumFractionDigits: minor,
      maximumFractionDigits: minor
    });
    return (minorAmount < 0 ? "-$" : "$") + (data.currency === "COP" ? " " : "") + value;
  }
  new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [
        {
          data: data.values,
          backgroundColor: data.colors,
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      cutout: "62%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.floor(ctx.parsed * 100 / total) : 0;
              return " " + ctx.label + ": " + fmtMoney(ctx.parsed) + " (" + pct + "%)";
            }
          }
        }
      }
    }
  });
})();
