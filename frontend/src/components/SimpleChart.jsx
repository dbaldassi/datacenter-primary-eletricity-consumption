import React, { useRef } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './SimpleChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function SimpleChart({ data, config, onClose, onEdit }) {
  const chartRef = useRef(null);

  const colorSchemes = {
    default: ['rgb(75, 192, 192)', 'rgb(255, 99, 132)', 'rgb(54, 162, 235)', 'rgb(255, 206, 86)', 'rgb(153, 102, 255)'],
    vibrant: ['rgb(255, 0, 127)', 'rgb(0, 191, 255)', 'rgb(50, 205, 50)', 'rgb(255, 140, 0)', 'rgb(238, 130, 238)'],
    pastel: ['rgb(255, 179, 186)', 'rgb(255, 223, 186)', 'rgb(255, 255, 186)', 'rgb(186, 255, 201)', 'rgb(186, 225, 255)'],
    monochrome: ['rgb(100, 100, 100)', 'rgb(150, 150, 150)', 'rgb(200, 200, 200)', 'rgb(75, 75, 75)', 'rgb(125, 125, 125)']
  };

  const colors = colorSchemes[config.colorScheme] || colorSchemes.default;

  // Prepare datasets
  const datasets = [];
  let colorIndex = 0;

  // Add Y axis columns
  config.yColumns.forEach(col => {
    const color = colors[colorIndex % colors.length];
    const bgColor = color.replace(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/, 'rgba($1, $2, $3, 0.5)');
    
    datasets.push({
      label: col,
      columnName: col,  // Store original column name for data access
      borderColor: color,
      backgroundColor: bgColor,
      yAxisID: 'y',
      tension: config.chartType === 'line' ? 0.4 : 0,
      pointRadius: config.chartType === 'scatter' ? 5 : 3,
    });
    colorIndex++;
  });

  // Add Y2 axis columns if any
  config.y2Columns.forEach(col => {
    const color = colors[colorIndex % colors.length];
    const bgColor = color.replace(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/, 'rgba($1, $2, $3, 0.5)');
    
    datasets.push({
      label: col + ' (Y2)',
      columnName: col,  // Store original column name for data access
      borderColor: color,
      backgroundColor: bgColor,
      yAxisID: 'y2',
      tension: config.chartType === 'line' ? 0.4 : 0,
      pointRadius: config.chartType === 'scatter' ? 5 : 3,
    });
    colorIndex++;
  });

  // Prepare chart data
  // For numeric X axis (not treated as labels), use x/y format for datasets
  const useNumericX = !config.xAsLabels;
  
  let chartData;
  if (useNumericX) {
    // Use x/y format for numeric X axis
    chartData = {
      datasets: datasets.map(ds => ({
        ...ds,
        data: data.map(row => ({
          x: row[config.xColumn],
          y: row[ds.columnName]
        }))
      }))
    };
  } else {
    // Use labels format for categorical X axis
    chartData = {
      labels: data.map(row => row[config.xColumn]),
      datasets: datasets.map(ds => ({
        ...ds,
        data: data.map(row => row[ds.columnName])
      }))
    };
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      x: {
        type: config.xAsLabels ? 'category' : (config.xLogarithmicScale ? 'logarithmic' : 'linear'),
        title: {
          display: true,
          text: config.xAxisLabel,
        },
        ...(config.chartType === 'bar-stacked' && {
          stacked: true,
        }),
      },
      y: {
        type: (config.logarithmicScale && config.chartType !== 'bar-stacked') ? 'logarithmic' : 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: config.yAxisLabel,
        },
        ...(config.chartType === 'bar-stacked' && {
          stacked: true,
        }),
      },
      ...(config.y2Columns.length > 0 && {
        y2: {
          type: (config.logarithmicScale && config.chartType !== 'bar-stacked') ? 'logarithmic' : 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: config.y2AxisLabel,
          },
          grid: {
            drawOnChartArea: false,
          },
          ...(config.chartType === 'bar-stacked' && {
            stacked: true,
          }),
        },
      }),
    },
  };

  let ChartComponent = Line;
  if (config.chartType === 'bar' || config.chartType === 'bar-stacked') {
    ChartComponent = Bar;
  } else if (config.chartType === 'scatter') {
    ChartComponent = Scatter;
  }

  const downloadChart = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `chart-${Date.now()}.png`;
      link.href = url;
      link.click();
    }
  };

  return (
    <div className="simple-chart-container">
      <div className="simple-chart-header">
        <h3>📊 Chart Visualization</h3>
        <div className="simple-chart-actions">
          <button onClick={onEdit} className="btn-edit">
            ✏️ Edit Configuration
          </button>
          <button onClick={downloadChart} className="btn-download">
            💾 Download
          </button>
          <button onClick={onClose} className="btn-close">
            ✕ Close Chart
          </button>
        </div>
      </div>

      <div className="simple-chart-info">
        <div><strong>Chart Type:</strong> {config.chartType}</div>
        <div><strong>X Axis:</strong> {config.xAxisLabel}</div>
        <div><strong>Y Axis:</strong> {config.yColumns.length} column(s)</div>
        {config.y2Columns.length > 0 && (
          <div><strong>Y2 Axis:</strong> {config.y2Columns.length} column(s)</div>
        )}
      </div>

      <div className="simple-chart-wrapper">
        <ChartComponent ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}

export default SimpleChart;
