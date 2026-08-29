const Charts = (function () {
  const ctxComparison = "comparisonChart";
  const ctxSupply = "supplyDemandChart";
  const ctxSector = "sectorDemandChart";
  const ctxAge = "ageDistributionChart";
  const ctxGender = "genderDistributionChart";
  const ctxMethod = "methodDistributionChart";
  const ctxTrend = "historicalTrendChart";

  let comparisonChartInstance = null;
  let supplyChartInstance = null;
  let sectorChartInstance = null;
  let ageChartInstance = null;
  let genderChartInstance = null;
  let methodChartInstance = null;
  let trendChartInstance = null;

  function destroyChart(name, instance) {
    if (instance) {
      instance.destroy();
    }
  }

  function renderAll(data) {
    renderComparison(data.municipalities || []);
    renderSupplyDemand(data.supplyDemand || {});
    renderSectorDemand(data.supplyDemand || {});
    renderAgeDistribution(data.demographics || {});
    renderGenderDistribution(data.demographics || {});
  }

  function renderComparison(municipalities) {
    destroyChart(ctxComparison, comparisonChartInstance);
    const sorted = [...municipalities].sort((a, b) => b.productionMT - a.productionMT);
    const labels = sorted.map((m) => m.name);
    const values = sorted.map((m) => m.productionMT);
    const ctx = document.getElementById(ctxComparison);
    if (!ctx) return;
    comparisonChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Production (MT)",
            data: values,
            backgroundColor: "#0d6efd",
            borderRadius: 4,
          }
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const rank = sorted[ctx.dataIndex].productionRank;
                return `${ctx.formattedValue} MT — Rank #${rank} of ${sorted.length}`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Metric Tons" } },
          y: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  function renderSupplyDemand(supplyDemand) {
    destroyChart(ctxSupply, supplyChartInstance);
    const ctx = document.getElementById(ctxSupply);
    if (!ctx) return;
    const labels = ["National Demand", "Pangasinan Supply", "Imported Salt"];
    const values = [supplyDemand.nationalDemandMT || 0, supplyDemand.pangasinanSupplyMT || 0, supplyDemand.importedMT || 0];
    const colors = ["#dc3545", "#198754", "#0d6efd"];
    supplyChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Metric Tons",
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.formattedValue} MT`
            }
          }
        },
        scales: {
          y: { ticks: { callback: (v) => v.toLocaleString() } }
        }
      }
    });
  }

  function renderSectorDemand(supplyDemand) {
    destroyChart(ctxSector, sectorChartInstance);
    const ctx = document.getElementById(ctxSector);
    if (!ctx) return;
    const sector = supplyDemand.sectorDemand || {};
    const labels = Object.keys(sector).map((k) => k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()));
    const values = Object.values(sector);
    const colors = ["#198754", "#0dcaf0", "#ffc107", "#0d6efd"];
    sectorChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 1,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.formattedValue} MT`
            }
          }
        }
      }
    });
  }

  function renderAgeDistribution(demographics) {
    destroyChart(ctxAge, ageChartInstance);
    const ctx = document.getElementById(ctxAge);
    if (!ctx) return;
    const age = demographics.provinceWide?.ageGroups || {};
    const labels = Object.keys(age);
    const values = Object.values(age);
    ageChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Producers",
            data: values,
            backgroundColor: "#198754",
            borderRadius: 4,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  function renderGenderDistribution(demographics) {
    destroyChart(ctxGender, genderChartInstance);
    const ctx = document.getElementById(ctxGender);
    if (!ctx) return;
    const gender = demographics.provinceWide?.genderDistribution || {};
    const labels = Object.keys(gender).map((k) => k === "notSpecified" ? "Not Specified" : k.charAt(0).toUpperCase() + k.slice(1));
    const values = Object.values(gender);
    const colors = ["#0d6efd", "#dc3545", "#6c757d"];
    genderChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 1,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.formattedValue}`
            }
          }
        }
      }
    });
  }

  function renderMethodDistribution(municipality) {
    destroyChart(ctxMethod, methodChartInstance);
    const ctx = document.getElementById(ctxMethod);
    if (!ctx) return;
    const labels = ["Solar", "Cooked", "Hybrid"];
    const values = [municipality.solarProductionMT || 0, municipality.cookedProductionMT || 0, municipality.hybridProductionMT || 0];
    const colors = ["#198754", "#dc3545", "#ffc107"];
    methodChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 1,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.formattedValue} MT`
            }
          }
        }
      }
    });
  }

  function renderHistoricalTrend(municipality) {
    destroyChart(ctxTrend, trendChartInstance);
    const ctx = document.getElementById(ctxTrend);
    if (!ctx) return;
    const hist = municipality.historicalProduction || {};
    const labels = Object.keys(hist).sort();
    const values = labels.map((y) => hist[y]);
    trendChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Production (MT)",
            data: values,
            borderColor: "#198754",
            backgroundColor: "rgba(25,135,84,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#198754",
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => v.toLocaleString() } }
        }
      }
    });
  }

  function renderDemographics(municipalityId) {
    const demographics = Dashboard.getDemographics();
    const muniDemo = demographics.byMunicipality?.[municipalityId];
    if (!muniDemo) {
      const ageEmpty = document.getElementById("detail-age-empty");
      const genderEmpty = document.getElementById("detail-gender-empty");
      if (ageEmpty) ageEmpty.style.display = "block";
      if (genderEmpty) genderEmpty.style.display = "block";
      return;
    }
    const ageEmpty = document.getElementById("detail-age-empty");
    const genderEmpty = document.getElementById("detail-gender-empty");
    if (ageEmpty) ageEmpty.style.display = "none";
    if (genderEmpty) genderEmpty.style.display = "none";

    const ageGroups = muniDemo.ageGroups || {};
    const ageCtx = document.getElementById("detailAgeChart");
    if (ageCtx) {
      if (window._detailAgeChartInstance) window._detailAgeChartInstance.destroy();
      window._detailAgeChartInstance = new Chart(ageCtx, {
        type: "bar",
        data: {
          labels: Object.keys(ageGroups),
          datasets: [{ label: "Producers", data: Object.values(ageGroups), backgroundColor: "#198754", borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    const genderDist = muniDemo.genderDistribution || {};
    const genderCtx = document.getElementById("detailGenderChart");
    if (genderCtx) {
      if (window._detailGenderChartInstance) window._detailGenderChartInstance.destroy();
      const labels = Object.keys(genderDist).map((k) => k === "notSpecified" ? "Not Specified" : k.charAt(0).toUpperCase() + k.slice(1));
      const colors = ["#0d6efd", "#dc3545", "#6c757d"];
      window._detailGenderChartInstance = new Chart(genderCtx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{ data: Object.values(genderDist), backgroundColor: colors, borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } } } }
      });
    }
  }

  return {
    renderAll,
    renderMethodDistribution,
    renderHistoricalTrend,
    renderDemographics,
  };
})();
