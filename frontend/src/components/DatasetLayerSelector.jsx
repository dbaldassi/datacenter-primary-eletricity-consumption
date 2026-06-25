import React, { useState, useEffect } from 'react';
import { fetchGeoDatasets, fetchGeoDatasetById } from '../services/api';
import './DatasetLayerSelector.css';

const DatasetLayerSelector = ({ onLayersChange }) => {
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState({});
  const [loadingDatasets, setLoadingDatasets] = useState({});
  const [error, setError] = useState(null);

  // Fetch available datasets on mount
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const data = await fetchGeoDatasets();
        setDatasets(data);
      } catch (err) {
        setError('Erreur lors du chargement des datasets géographiques');
        console.error('Error fetching geo datasets:', err);
      }
    };
    
    loadDatasets();
  }, []);

  // Handle dataset selection/deselection
  const handleDatasetToggle = async (dataset) => {
    const datasetId = dataset.id;
    
    if (selectedDatasets[datasetId]) {
      // Deselect: remove from selected datasets
      const newSelected = { ...selectedDatasets };
      delete newSelected[datasetId];
      setSelectedDatasets(newSelected);
      
      // Notify parent with updated layers
      onLayersChange(Object.values(newSelected));
    } else {
      // Select: fetch and add to selected datasets
      setLoadingDatasets({ ...loadingDatasets, [datasetId]: true });
      
      try {
        const geojsonData = await fetchGeoDatasetById(datasetId);
        
        const newSelected = {
          ...selectedDatasets,
          [datasetId]: {
            id: datasetId,
            name: dataset.name,
            type: dataset.type,
            data: geojsonData
          }
        };
        
        setSelectedDatasets(newSelected);
        onLayersChange(Object.values(newSelected));
      } catch (err) {
        setError(`Erreur lors du chargement de ${dataset.name}`);
        console.error('Error fetching geo dataset:', err);
      } finally {
        setLoadingDatasets({ ...loadingDatasets, [datasetId]: false });
      }
    }
  };

  // Get icon based on dataset type
  const getDatasetIcon = (type, sourceFormat) => {
    if (type === 'geojson' || sourceFormat === 'geojson') {
      return '🗺️'; // Map for zones
    } else if (sourceFormat === 'csv_gps') {
      return '📍'; // Pin for GPS points
    } else if (sourceFormat === 'csv_address') {
      return '🏢'; // Building for addresses
    }
    return '📊'; // Default
  };

  return (
    <div className="dataset-layer-selector">
      <h3>Couches géographiques</h3>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="datasets-list">
        {datasets.length === 0 ? (
          <p className="no-datasets">Aucun dataset géographique disponible</p>
        ) : (
          datasets.map((dataset) => (
            <div key={dataset.id} className="dataset-item">
              <label className="dataset-label">
                <input
                  type="checkbox"
                  checked={!!selectedDatasets[dataset.id]}
                  onChange={() => handleDatasetToggle(dataset)}
                  disabled={loadingDatasets[dataset.id]}
                />
                <span className="dataset-icon">
                  {getDatasetIcon(dataset.type, dataset.source_format)}
                </span>
                <span className="dataset-name">{dataset.name}</span>
                {loadingDatasets[dataset.id] && (
                  <span className="loading-spinner">⏳</span>
                )}
              </label>
              <div className="dataset-info">
                <span className="dataset-type">{dataset.type}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {Object.keys(selectedDatasets).length > 0 && (
        <div className="selected-layers-info">
          <strong>Couches actives:</strong> {Object.keys(selectedDatasets).length}
        </div>
      )}
    </div>
  );
};

export default DatasetLayerSelector;
