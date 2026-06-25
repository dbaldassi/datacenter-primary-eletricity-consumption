/**
 * Utility functions for popup chart processing
 */

/**
 * Detect numeric columns from properties array
 * @param {Array} propertiesArray - Array of property objects
 * @returns {Array} - Array of numeric column names
 */
export const detectNumericColumns = (propertiesArray) => {
  if (!propertiesArray || propertiesArray.length === 0) return [];
  
  const firstProperties = propertiesArray[0];
  const numericColumns = [];
  
  // Common field names to exclude from automatic detection
  const excludeFields = [
    'id', 'code', 'region_code', 'department_code', 'postal_code',
    'year', 'annee', 'année', 'date', 'timestamp',
    'latitude', 'longitude', 'lat', 'lon', 'lng'
  ];
  
  for (const [key, value] of Object.entries(firstProperties)) {
    // Check if it's a number and not in exclude list
    if (typeof value === 'number' && !excludeFields.includes(key.toLowerCase())) {
      // Verify it's numeric across all entries
      const isNumericAcrossAll = propertiesArray.every(
        props => typeof props[key] === 'number' || props[key] === null || props[key] === undefined
      );
      
      if (isNumericAcrossAll) {
        numericColumns.push(key);
      }
    }
  }
  
  return numericColumns;
};

/**
 * Detect time/year field from properties
 * @param {Array} propertiesArray - Array of property objects
 * @returns {string|null} - Name of the time field
 */
export const detectTimeField = (propertiesArray) => {
  if (!propertiesArray || propertiesArray.length === 0) return null;
  
  const timeFields = ['year', 'année', 'annee', 'date', 'timestamp', 'time'];
  const firstProperties = propertiesArray[0];
  
  for (const field of timeFields) {
    if (firstProperties[field] !== undefined) {
      return field;
    }
  }
  
  return null;
};

/**
 * Prepare chart data from properties array
 * @param {Array} propertiesArray - Array of property objects
 * @param {string} selectedColumn - Column to chart
 * @param {string} timeField - Time/year field name
 * @returns {Object} - Chart.js data object
 */
export const prepareChartData = (propertiesArray, selectedColumn, timeField) => {
  if (!propertiesArray || !selectedColumn) return null;
  
  // Sort by time field if available
  const sortedProperties = timeField
    ? [...propertiesArray].sort((a, b) => {
        const aVal = a[timeField];
        const bVal = b[timeField];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return aVal - bVal;
        }
        return String(aVal).localeCompare(String(bVal));
      })
    : propertiesArray;
  
  // Extract labels and data
  const labels = sortedProperties.map((props, idx) => {
    if (timeField && props[timeField] !== undefined) {
      return String(props[timeField]);
    }
    return `Entrée ${idx + 1}`;
  });
  
  const data = sortedProperties.map(props => props[selectedColumn]);
  
  // Format column name for display
  const formattedColumnName = selectedColumn
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  return {
    labels,
    datasets: [
      {
        label: formattedColumnName,
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
      },
    ],
  };
};
