import React from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { detectTimeField, prepareChartData } from './popupChartUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * PopupChart component for rendering charts in Leaflet popups
 */
const PopupChart = ({ propertiesArray, selectedColumn, chartType = 'line' }) => {
  const timeField = detectTimeField(propertiesArray);
  const chartData = prepareChartData(propertiesArray, selectedColumn, timeField);
  
  if (!chartData) return null;
  
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    plugins: {
      legend: {
        display: false, // Hide legend to save space
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value) {
            // Format large numbers
            if (Math.abs(value) >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (Math.abs(value) >= 1000) {
              return (value / 1000).toFixed(1) + 'K';
            }
            return value;
          },
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
    },
  };
  
  const ChartComponent = chartType === 'bar' ? Bar : Line;
  
  return (
    <div style={{ width: '100%', maxWidth: '400px', padding: '10px 0' }}>
      <ChartComponent data={chartData} options={options} />
    </div>
  );
};

export default PopupChart;
