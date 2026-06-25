import React, { useState, useEffect } from 'react';
import './SimpleChartConfig.css';

function SimpleChartConfig({ columns, onGenerateChart, onClose, initialConfig }) {
  const [xColumn, setXColumn] = useState(initialConfig?.xColumn || '');
  const [yColumns, setYColumns] = useState(initialConfig?.yColumns || []);
  const [y2Columns, setY2Columns] = useState(initialConfig?.y2Columns || []);
  const [xAxisLabel, setXAxisLabel] = useState(initialConfig?.xAxisLabel || '');
  const [yAxisLabel, setYAxisLabel] = useState(initialConfig?.yAxisLabel || '');
  const [y2AxisLabel, setY2AxisLabel] = useState(initialConfig?.y2AxisLabel || '');
  const [chartType, setChartType] = useState(initialConfig?.chartType || 'line');
  const [colorScheme, setColorScheme] = useState(initialConfig?.colorScheme || 'default');
  const [logarithmicScale, setLogarithmicScale] = useState(initialConfig?.logarithmicScale || false);
  const [xAsLabels, setXAsLabels] = useState(initialConfig?.xAsLabels ?? false);
  const [xLogarithmicScale, setXLogarithmicScale] = useState(initialConfig?.xLogarithmicScale || false);

  useEffect(() => {
    // Auto-select first column as X axis only if no initial config
    if (columns.length > 0 && !xColumn && !initialConfig) {
      setXColumn(columns[0]);
      setXAxisLabel(columns[0]);
    }
  }, [columns, xColumn, initialConfig]);

  const handleYColumnToggle = (col) => {
    setYColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleY2ColumnToggle = (col) => {
    setY2Columns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleGenerate = () => {
    if (!xColumn || yColumns.length === 0) {
      alert('Please select at least an X column and one Y column');
      return;
    }

    onGenerateChart({
      xColumn,
      yColumns,
      y2Columns,
      xAxisLabel: xAxisLabel || xColumn,
      yAxisLabel: yAxisLabel || 'Value',
      y2AxisLabel: y2AxisLabel || 'Value (Y2)',
      chartType,
      colorScheme,
      logarithmicScale,
      xAsLabels,
      xLogarithmicScale
    });
  };

  return (
    <div className="simple-chart-config">
      <div className="config-header">
        <h3>📊 Configure Chart Visualization</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="config-content">
        {/* X Axis Selection */}
        <div className="config-section">
          <label>X Axis (Horizontal)</label>
          <select value={xColumn} onChange={(e) => {
            setXColumn(e.target.value);
            if (!xAxisLabel) setXAxisLabel(e.target.value);
          }}>
            <option value="">Select column...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Custom axis label (optional)"
            value={xAxisLabel}
            onChange={(e) => setXAxisLabel(e.target.value)}
            className="axis-label-input"
          />
        </div>

        {/* Y Axis Selection */}
        <div className="config-section">
          <label>Y Axis (Left - Values)</label>
          <div className="column-checkboxes">
            {columns.filter(col => col !== xColumn).map(col => (
              <div key={col} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`y-${col}`}
                  checked={yColumns.includes(col)}
                  onChange={() => handleYColumnToggle(col)}
                />
                <label htmlFor={`y-${col}`}>{col}</label>
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Custom Y axis label (optional)"
            value={yAxisLabel}
            onChange={(e) => setYAxisLabel(e.target.value)}
            className="axis-label-input"
          />
        </div>

        {/* Y2 Axis Selection */}
        <div className="config-section">
          <label>Y2 Axis (Right - Optional)</label>
          <div className="column-checkboxes">
            {columns.filter(col => col !== xColumn && !yColumns.includes(col)).map(col => (
              <div key={col} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`y2-${col}`}
                  checked={y2Columns.includes(col)}
                  onChange={() => handleY2ColumnToggle(col)}
                />
                <label htmlFor={`y2-${col}`}>{col}</label>
              </div>
            ))}
          </div>
          {y2Columns.length > 0 && (
            <input
              type="text"
              placeholder="Custom Y2 axis label (optional)"
              value={y2AxisLabel}
              onChange={(e) => setY2AxisLabel(e.target.value)}
              className="axis-label-input"
            />
          )}
        </div>

        {/* Chart Type */}
        <div className="config-section">
          <label>Chart Type</label>
          <div className="chart-type-buttons">
            <button
              className={chartType === 'line' ? 'active' : ''}
              onClick={() => setChartType('line')}
            >
              📈 Line
            </button>
            <button
              className={chartType === 'bar' ? 'active' : ''}
              onClick={() => setChartType('bar')}
            >
              📊 Bar
            </button>
            <button
              className={chartType === 'bar-stacked' ? 'active' : ''}
              onClick={() => setChartType('bar-stacked')}
            >
              📊 Bar (Stacked)
            </button>
            <button
              className={chartType === 'scatter' ? 'active' : ''}
              onClick={() => setChartType('scatter')}
            >
              🔵 Scatter
            </button>
          </div>
        </div>

        {/* Logarithmic Scale */}
        <div className="config-section">
          <label>Scale Options</label>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="logarithmic-scale"
              checked={logarithmicScale}
              onChange={(e) => setLogarithmicScale(e.target.checked)}
              disabled={chartType === 'bar-stacked'}
            />
            <label htmlFor="logarithmic-scale">
              Use Logarithmic Scale (Y axis)
              {chartType === 'bar-stacked' && ' (not available for stacked charts)'}
            </label>
          </div>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="x-as-labels"
              checked={xAsLabels}
              onChange={(e) => {
                setXAsLabels(e.target.checked);
                if (e.target.checked) {
                  // Disable X log scale when using labels
                  setXLogarithmicScale(false);
                }
              }}
            />
            <label htmlFor="x-as-labels">
              Treat X axis as text labels (uncheck for numeric values)
            </label>
          </div>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="x-logarithmic-scale"
              checked={xLogarithmicScale}
              onChange={(e) => setXLogarithmicScale(e.target.checked)}
              disabled={xAsLabels}
            />
            <label htmlFor="x-logarithmic-scale">
              Use Logarithmic Scale (X axis)
              {xAsLabels && ' (not available when X is treated as labels)'}
            </label>
          </div>
        </div>

        {/* Color Scheme */}
        <div className="config-section">
          <label>Color Scheme</label>
          <select value={colorScheme} onChange={(e) => setColorScheme(e.target.value)}>
            <option value="default">Default</option>
            <option value="vibrant">Vibrant</option>
            <option value="pastel">Pastel</option>
            <option value="monochrome">Monochrome</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="config-actions">
          <button onClick={handleGenerate} className="btn-primary">
            ✨ Generate Chart
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimpleChartConfig;
