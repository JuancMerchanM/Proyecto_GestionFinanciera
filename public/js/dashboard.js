"use strict";
const readJson = (id) => {
  const el = document.getElementById(id);
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
};
const minorOf = (currency) => currency === "USD" ? 2 : 0;
const fmtMoney = (minorAmount, currency) => {
  const minor = minorOf(currency);
  const abs = Math.abs(minorAmount);
  const value = (abs / Math.pow(10, minor)).toLocaleString("es-CO", {
    minimumFractionDigits: minor,
    maximumFractionDigits: minor
  });
  return (minorAmount < 0 ? "-$" : "$") + (currency === "COP" ? " " : "") + value;
};
const moneyTooltip = (currency) => (ctx) => {
  const value = typeof ctx.parsed.y === "number" ? ctx.parsed.y : ctx.parsed.x ?? 0;
  return " " + ctx.label + ": " + fmtMoney(value, currency);
};
const initDonut = () => {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("expenses-donut");
  if (!canvas) return;
  const data = readJson("dash-data");
  if (!data || !data.values || data.values.length === 0) return;
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
              return " " + ctx.label + ": " + fmtMoney(ctx.parsed, data.currency) + " (" + pct + "%)";
            }
          }
        }
      }
    }
  });
};
const initTimeline = () => {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("timeline-chart");
  if (!canvas) return;
  const data = readJson("timeline-data");
  if (!data || !data.labels || data.labels.length === 0) return;
  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Ingresos",
          data: data.income,
          borderColor: "#1f9d61",
          backgroundColor: "rgba(31, 157, 97, 0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: data.labels.length > 45 ? 0 : 2
        },
        {
          label: "Gastos",
          data: data.expense,
          borderColor: "#d64545",
          backgroundColor: "rgba(214, 69, 69, 0.12)",
          fill: true,
          tension: 0.25,
          pointRadius: data.labels.length > 45 ? 0 : 2
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: moneyTooltip(data.currency) } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => fmtMoney(Number(v), data.currency) }
        }
      }
    }
  });
};
const initMembers = () => {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("members-chart");
  if (!canvas) return;
  const data = readJson("members-data");
  if (!data || !data.labels || data.labels.length === 0) return;
  new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        { label: "Ingresos", data: data.income, backgroundColor: "#1f9d61" },
        { label: "Gastos", data: data.expense, backgroundColor: "#d64545" }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: moneyTooltip(data.currency) } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => fmtMoney(Number(v), data.currency) }
        }
      }
    }
  });
};
initDonut();
initTimeline();
initMembers();
