import React, { useState, useEffect, useMemo } from 'react';
import { calculateMatches, exportMatchesToCSV, exportMatchesToPayload } from '../utils/distanceUtils';
import { importMatchesToDB } from '../services/api';
import './DistanceCalculator.css';

const DistanceCalculator = ({ layers, onMatchesChange, onFocusCoordinates }) => {
  const [layer1Id, setLayer1Id] = useState('');
  const [layer2Id, setLayer2Id] = useState('');
  const [thresholdMeters, setThresholdMeters] = useState(1000);
  const [matches, setMatches] = useState([]);
  const [showNonMatches, setShowNonMatches] = useState(false);
  
  // Validation state
  const [validationMode, setValidationMode] = useState(null); // null, 'import-all', 'manual'
  const [validationStatuses, setValidationStatuses] = useState({}); // { matchIndex: 'validated' | 'discarded' | 'pending' }
  const [currentValidationIndex, setCurrentValidationIndex] = useState(0);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showDatabaseSelector, setShowDatabaseSelector] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Filter layers to only show those with point features
  const pointLayers = useMemo(() => {
    return layers.filter(layer => {
      const features = layer.data?.features || [];
      return features.some(f => f.geometry?.type === 'Point');
    });
  }, [layers]);

  // Calculate matches when parameters change
  useEffect(() => {
    if (!layer1Id || !layer2Id || layer1Id === layer2Id) {
      setMatches([]);
      if (onMatchesChange) {
        onMatchesChange([], showNonMatches);
      }
      return;
    }

    const layer1 = layers.find(l => l.id === layer1Id);
    const layer2 = layers.find(l => l.id === layer2Id);

    if (!layer1 || !layer2) {
      setMatches([]);
      if (onMatchesChange) {
        onMatchesChange([], showNonMatches);
      }
      return;
    }

    const features1 = layer1.data?.features || [];
    const features2 = layer2.data?.features || [];

    const calculatedMatches = calculateMatches(features1, features2, thresholdMeters);
    setMatches(calculatedMatches);
    
    // Initialize validation statuses for all matches as pending
    const initialStatuses = {};
    calculatedMatches.forEach((_, index) => {
      initialStatuses[index] = 'pending';
    });
    setValidationStatuses(initialStatuses);
    setCurrentValidationIndex(0);
    
    if (onMatchesChange) {
      onMatchesChange(calculatedMatches, showNonMatches);
    }
  // Intentionally omitting onMatchesChange from dependency array to prevent infinite re-render loop
  // The callback reference changes on every parent render, which would cause this effect to run repeatedly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer1Id, layer2Id, thresholdMeters, layers]);

  // Propagate showNonMatches changes without recalculating matches
  useEffect(() => {
    if (onMatchesChange) {
      onMatchesChange(matches, showNonMatches);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNonMatches]);

  // Focus map on current match during manual validation
  useEffect(() => {
    if (validationMode === 'manual' && onFocusCoordinates && matches.length > 0 && currentValidationIndex < matches.length) {
      const currentMatch = matches[currentValidationIndex];
      // Focus on the midpoint between the two matched points
      const midLat = (currentMatch.coords1.lat + currentMatch.coords2.lat) / 2;
      const midLon = (currentMatch.coords1.lon + currentMatch.coords2.lon) / 2;
      onFocusCoordinates({ lat: midLat, lon: midLon, zoom: 16 });
    }
  }, [validationMode, currentValidationIndex, matches]);

  // Memoize distance statistics
  const distanceStats = useMemo(() => {
    if (matches.length === 0) {
      return null;
    }
    
    const distances = matches.map(m => m.distance);
    return {
      min: Math.min(...distances).toFixed(2),
      max: Math.max(...distances).toFixed(2),
      avg: (distances.reduce((sum, d) => sum + d, 0) / distances.length).toFixed(2)
    };
  }, [matches]);

  // Format threshold for display
  const formatThreshold = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  // Handle export to CSV
  const handleExportCSV = () => {
    if (matches.length === 0) return;

    const layer1 = layers.find(l => l.id === layer1Id);
    const layer2 = layers.find(l => l.id === layer2Id);

    const csvContent = exportMatchesToCSV(matches, layer1.name, layer2.name);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `distance_matches_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle import to DB button click
  const handleImportToDB = () => {
    setShowValidationModal(true);
  };

  // Handle validation mode selection
  const handleValidationModeSelect = (mode) => {
    setValidationMode(mode);
    setShowValidationModal(false);
    
    if (mode === 'import-all') {
      // Mark all as validated
      const allValidated = {};
      matches.forEach((_, index) => {
        allValidated[index] = 'validated';
      });
      setValidationStatuses(allValidated);
      // Show database selector
      setShowDatabaseSelector(true);
    } else if (mode === 'manual') {
      // Start manual validation from the first match
      setCurrentValidationIndex(0);
    }
  };

  // Handle validate current match
  const handleValidateMatch = () => {
    setValidationStatuses(prev => ({
      ...prev,
      [currentValidationIndex]: 'validated'
    }));
    
    // Move to next match
    if (currentValidationIndex < matches.length - 1) {
      setCurrentValidationIndex(currentValidationIndex + 1);
    } else {
      // Validation complete, show database selector
      setValidationMode(null);
      setShowDatabaseSelector(true);
    }
  };

  // Handle discard current match
  const handleDiscardMatch = () => {
    setValidationStatuses(prev => ({
      ...prev,
      [currentValidationIndex]: 'discarded'
    }));
    
    // Move to next match
    if (currentValidationIndex < matches.length - 1) {
      setCurrentValidationIndex(currentValidationIndex + 1);
    } else {
      // Validation complete, show database selector
      setValidationMode(null);
      setShowDatabaseSelector(true);
    }
  };

  // Cancel validation
  const handleCancelValidation = () => {
    setValidationMode(null);
    setShowValidationModal(false);
    setShowDatabaseSelector(false);
    // Reset validation statuses
    const resetStatuses = {};
    matches.forEach((_, index) => {
      resetStatuses[index] = 'pending';
    });
    setValidationStatuses(resetStatuses);
    setCurrentValidationIndex(0);
  };

  // Handle final import to database
  const handleFinalImport = async () => {
    if (!selectedDatabase) {
      // TODO: Replace with a proper notification system for better UX
      alert('Veuillez sélectionner une base de données');
      return;
    }

    setIsImporting(true);
    
    try {
      // Filter matches to only include validated ones
      const validatedMatches = matches.filter((_, index) => validationStatuses[index] === 'validated');
      
      if (validatedMatches.length === 0) {
        // TODO: Replace with a proper notification system for better UX
        alert('Aucune correspondance validée à importer');
        setIsImporting(false);
        return;
      }

      const layer1 = layers.find(l => l.id === layer1Id);
      const layer2 = layers.find(l => l.id === layer2Id);

        console.log(layer1);

      // Generate CSV content
      const payload = exportMatchesToPayload(validatedMatches, layer1, layer2);
      
      // Import to database
      const result = await importMatchesToDB(selectedDatabase, selectedTable, payload);
      
      // TODO: Replace with a proper notification system for better UX
      alert(`Succès! ${result.message}\nTotal de lignes dans la table: ${result.total_rows}`);
      
      // Reset states
      setShowDatabaseSelector(false);
      setSelectedDatabase('');
      setValidationMode(null);
      
    } catch (error) {
      console.error('Error importing to database:', error);
      // TODO: Replace with a proper notification system for better UX
      alert(`Erreur lors de l'importation: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Slider scale: logarithmic for better UX
  // 10m to 20km: use log scale
  const minLog = Math.log10(10);
  const maxLog = Math.log10(20000);
  
  const sliderToMeters = (value) => {
    const logValue = minLog + (value / 100) * (maxLog - minLog);
    return Math.round(Math.pow(10, logValue));
  };

  const metersToSlider = (meters) => {
    const logValue = Math.log10(meters);
    return ((logValue - minLog) / (maxLog - minLog)) * 100;
  };

  const handleSliderChange = (e) => {
    const sliderValue = parseFloat(e.target.value);
    const meters = sliderToMeters(sliderValue);
    setThresholdMeters(meters);
  };

  if (pointLayers.length < 2) {
    return (
      <div className="distance-calculator">
        <h3>Calculateur de distance</h3>
        <div className="no-layers-message">
          Au moins deux couches avec des points GPS sont nécessaires
        </div>
      </div>
    );
  }

  return (
    <div className="distance-calculator">
      <h3>Calculateur de distance</h3>
      
      <div className="distance-calculator-controls">
        <div className="distance-calculator-row">
          <label htmlFor="layer1-select">Couche 1 (source)</label>
          <select
            id="layer1-select"
            value={layer1Id}
            onChange={(e) => setLayer1Id(e.target.value)}
          >
            <option value="">Sélectionner une couche...</option>
            {pointLayers.map(layer => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="distance-calculator-row">
          <label htmlFor="layer2-select">Couche 2 (cible)</label>
          <select
            id="layer2-select"
            value={layer2Id}
            onChange={(e) => setLayer2Id(e.target.value)}
            disabled={!layer1Id}
          >
            <option value="">Sélectionner une couche...</option>
            {pointLayers
              .filter(layer => layer.id !== layer1Id)
              .map(layer => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
          </select>
        </div>

        {layer1Id && layer2Id && layer1Id !== layer2Id && (
          <>
            <div className="distance-calculator-row">
              <div className="slider-container">
                <div className="slider-value">
                  <span>Seuil de distance: <span className="value">{formatThreshold(thresholdMeters)}</span></span>
                  <span className="matches">{matches.length} correspondance{matches.length !== 1 ? 's' : ''}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={metersToSlider(thresholdMeters)}
                  onChange={handleSliderChange}
                  className="distance-slider"
                />
              </div>
            </div>

            <div className="distance-calculator-row">
              <label className="filter-mode-checkbox">
                <input
                  type="checkbox"
                  checked={showNonMatches}
                  onChange={(e) => setShowNonMatches(e.target.checked)}
                />
                <span>Afficher uniquement les points NON appariés</span>
              </label>
            </div>

            {matches.length > 0 && (
              <>
                <div className="calculation-info">
                  <p>
                    Distance min: <span className="stat">{distanceStats.min} m</span>
                  </p>
                  <p>
                    Distance max: <span className="stat">{distanceStats.max} m</span>
                  </p>
                  <p>
                    Distance moyenne: <span className="stat">{distanceStats.avg} m</span>
                  </p>
                </div>

                <div className="export-buttons">
                  <button
                    className="export-button"
                    onClick={handleExportCSV}
                  >
                    📄 Exporter CSV
                  </button>
                  <button
                    className="export-button import-button"
                    onClick={handleImportToDB}
                  >
                    💾 Importer vers DB
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="modal-overlay" onClick={() => setShowValidationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Choisir le mode d'importation</h3>
            <p>Comment souhaitez-vous importer les correspondances?</p>
            <div className="modal-buttons">
              <button
                className="modal-button import-all-button"
                onClick={() => handleValidationModeSelect('import-all')}
              >
                ✓ Tout importer
              </button>
              <button
                className="modal-button manual-validate-button"
                onClick={() => handleValidationModeSelect('manual')}
              >
                👁 Valider manuellement
              </button>
            </div>
            <button
              className="modal-button cancel-button"
              onClick={() => setShowValidationModal(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Manual Validation UI */}
      {validationMode === 'manual' && currentValidationIndex < matches.length && (
        <div className="validation-panel">
          <div className="validation-header">
            <h4>Validation manuelle</h4>
            <span className="validation-progress">
              Match {currentValidationIndex + 1} / {matches.length}
            </span>
          </div>
          <div className="validation-info">
            <p><strong>Distance:</strong> {matches[currentValidationIndex].distance.toFixed(2)} m</p>
              <p><strong>Point 1:</strong> {matches[currentValidationIndex].coords1.lat.toFixed(6)}, {matches[currentValidationIndex].coords1.lon.toFixed(6)}, {matches[currentValidationIndex].point1.properties['name'] ?? matches[currentValidationIndex].point1.properties['Adresse']}</p>
            <p><strong>Point 2:</strong> {matches[currentValidationIndex].coords2.lat.toFixed(6)}, {matches[currentValidationIndex].coords2.lon.toFixed(6)}, {matches[currentValidationIndex].point2.properties['name'] ?? matches[currentValidationIndex].point2.properties['Adresse']}</p>
          </div>
          <div className="validation-buttons">
            <button
              className="validation-button validate-button"
              onClick={handleValidateMatch}
            >
              ✓ Valider
            </button>
            <button
              className="validation-button discard-button"
              onClick={handleDiscardMatch}
            >
              ✗ Écarter
            </button>
            <button
              className="validation-button cancel-button"
              onClick={handleCancelValidation}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Database Selector Modal */}
      {showDatabaseSelector && (
        <div className="modal-overlay" onClick={() => setShowDatabaseSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Sélectionner la base de données</h3>
            <p>
              {Object.values(validationStatuses).filter(s => s === 'validated').length} correspondances validées seront importées
            </p>
            <div className="database-input-group">
              <label htmlFor="database-input">Nom de la base de données (.db):</label>
              <input
                id="database-input"
                type="text"
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                placeholder="exemple.db"
                className="database-input"
              />
              <label htmlFor="table-input">Nom de la table:</label>
              <input
                id="table-input"
                type="text"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                placeholder="matches"
                className="database-input"
              />
            </div>
            <div className="modal-buttons">
              <button
                className="modal-button import-button"
                onClick={handleFinalImport}
                disabled={!selectedDatabase || isImporting}
              >
                {isImporting ? 'Importation...' : '💾 Importer'}
              </button>
              <button
                className="modal-button cancel-button"
                onClick={handleCancelValidation}
                disabled={isImporting}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistanceCalculator;
