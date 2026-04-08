<script lang="ts">
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
  import { reportsStore } from '../../stores/reports.svelte'

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

  let canvasEl: HTMLCanvasElement | undefined = $state()
  let chartInstance: Chart | null = null

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  function formatMonthLabel(key: string): string {
    const [year, month] = key.split('-')
    return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year.slice(2)}`
  }

  const chartData = $derived.by(() => {
    const monthly = reportsStore.aggregations?.monthly ?? []
    return [...monthly].sort((a, b) => a.month.localeCompare(b.month))
  })

  $effect(() => {
    if (!canvasEl || chartData.length === 0) {
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
      return
    }

    const labels = chartData.map((m) => formatMonthLabel(m.month))
    const grossData = chartData.map((m) => m.grossRevenue)
    const netData = chartData.map((m) => m.netRevenue)
    const feeData = chartData.map((m) => Math.abs(m.googleFees))

    if (chartInstance) {
      chartInstance.data.labels = labels
      chartInstance.data.datasets[0].data = grossData
      chartInstance.data.datasets[1].data = netData
      chartInstance.data.datasets[2].data = feeData
      chartInstance.update()
      return
    }

    chartInstance = new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Gross Revenue',
            data: grossData,
            backgroundColor: 'rgba(0, 102, 204, 0.7)',
            borderRadius: 4
          },
          {
            label: 'Net Revenue',
            data: netData,
            backgroundColor: 'rgba(46, 125, 50, 0.7)',
            borderRadius: 4
          },
          {
            label: 'Google Fees',
            data: feeData,
            backgroundColor: 'rgba(211, 47, 47, 0.4)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const currency = chartData[0]?.merchantCurrency ?? ''
                const val = ctx.parsed.y ?? 0
                try {
                  const formatted = new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency
                  }).format(val)
                  return `${ctx.dataset.label}: ${formatted}`
                } catch {
                  return `${ctx.dataset.label}: ${currency} ${val.toFixed(2)}`
                }
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 10 },
              callback(value) {
                return typeof value === 'number' ? value.toFixed(0) : String(value ?? '')
              }
            },
            grid: { color: '#f0f0f0' }
          },
          x: {
            ticks: { font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    })

    return () => {
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    }
  })
</script>

{#if chartData.length > 0}
  <div class="chart-container">
    <canvas bind:this={canvasEl}></canvas>
  </div>
{/if}

<style>
  .chart-container {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    height: 300px;
  }
</style>
