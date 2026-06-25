import React, { useState, useEffect, useMemo } from 'react';
import {
    fetchDuckDBDatabases,
    fetchDuckDBTables,
    executeDuckDBQuery,
    fetchSavedQueries,
    saveQuery,
    renameQuery,
    deleteQuery,
    geocodeDuckDBQuery
} from '../services/api';
import MapComponent from './MapComponent';
import DatasetLayerSelector from './DatasetLayerSelector';
import DistanceCalculator from './DistanceCalculator';
import SQLEditor from './SQLEditor';
import SimpleChartConfig from './SimpleChartConfig';
import SimpleChart from './SimpleChart';
import './DuckPage.css';

function DuckPage() {
    const [databases, setDatabases] = useState([]);
    const [selectedDatabase, setSelectedDatabase] = useState('');
    const [query, setQuery] = useState('SELECT * FROM energy_data LIMIT 10');
    const [queryResult, setQueryResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [savedQueries, setSavedQueries] = useState({});
    const [savingQuery, setSavingQuery] = useState(false);
    const [queryName, setQueryName] = useState('');
    const [tables, setTables] = useState([]);
    const [selectedSavedQuery, setSelectedSavedQuery] = useState('');
    const [renamingQuery, setRenamingQuery] = useState(null);
    const [newQueryName, setNewQueryName] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    // Map-related state
    const [geoLayers, setGeoLayers] = useState([]);
    const [sqlLayers, setSqlLayers] = useState([]);
    const [geocoding, setGeocoding] = useState(false);
    const [selectedLayerColor, setSelectedLayerColor] = useState('#ff0000');
    const [renamingLayer, setRenamingLayer] = useState(null);
    const [newLayerName, setNewLayerName] = useState('');
    const [distanceMatches, setDistanceMatches] = useState([]);
    const [showNonMatches, setShowNonMatches] = useState(false);
    const [focusCoordinates, setFocusCoordinates] = useState(null);

    const handleMatchesChange = (matches, showNonMatchesMode) => {
        setDistanceMatches(matches);
        setShowNonMatches(showNonMatchesMode);
    };

    const handleFocusCoordinates = (coordinates) => {
    setFocusCoordinates(coordinates);
  };

    // Chart-related state
    const [showChartConfig, setShowChartConfig] = useState(false);
    const [chartData, setChartData] = useState(null);
    const [chartConfig, setChartConfig] = useState(null);

    // Table collapse state
    const [expandedTables, setExpandedTables] = useState(new Set());


    // Auto-clear success messages after 3 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // Load databases and saved queries on mount
    useEffect(() => {
        loadDatabases();
        loadSavedQueries();
    }, []);

    // Load tables when database changes
    useEffect(() => {
        if (selectedDatabase) {
            loadTables();
        } else {
            setTables([]);
        }
    }, [selectedDatabase]);

    const loadDatabases = async () => {
        try {
            const dbs = await fetchDuckDBDatabases();
            setDatabases(dbs);
            if (dbs.length > 0 && !selectedDatabase) {
                setSelectedDatabase(dbs[0]);
            }
        } catch (err) {
            console.error('Error loading databases:', err);
            setError('Failed to load databases: ' + err.message);
        }
    };

    const loadTables = async () => {
        try {
            const tablesData = await fetchDuckDBTables(selectedDatabase);
            setTables(tablesData);
        } catch (err) {
            console.error('Error loading tables:', err);
            setError('Failed to load tables: ' + err.message);
        }
    };

    const loadSavedQueries = async () => {
        try {
            const queries = await fetchSavedQueries();
            setSavedQueries(queries);
        } catch (err) {
            console.error('Error loading saved queries:', err);
        }
    };

    const executeQuery = async () => {
        if (!selectedDatabase) {
            setError('Please select a database');
            return;
        }
        if (!query.trim()) {
            setError('Please enter a query');
            return;
        }

        setLoading(true);
        setError(null);
        setQueryResult(null);

        try {
            const result = await executeDuckDBQuery(selectedDatabase, query);
            setQueryResult(result);
        } catch (err) {
            console.error('Query error:', err);
            setError(err.response?.data?.detail || err.message || 'Query execution failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuery = async () => {
        if (!queryName.trim()) {
            setError('Please enter a name for the query');
            return;
        }
        if (!query.trim()) {
            setError('Query cannot be empty');
            return;
        }

        try {
            await saveQuery(queryName, selectedDatabase, query);
            setQueryName('');
            setSavingQuery(false);
            await loadSavedQueries();
            setSuccessMessage('Query saved successfully!');
        } catch (err) {
            setError('Failed to save query: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleLoadSavedQuery = (name) => {
        const saved = savedQueries[name];
        if (saved) {
            setQuery(saved.query);
            setSelectedDatabase(saved.database);
            setSelectedSavedQuery(name);
        }
    };

    const handleDeleteQuery = async (name) => {
        setShowDeleteConfirm(name);
    };

    const confirmDelete = async () => {
        const name = showDeleteConfirm;
        setShowDeleteConfirm(null);

        try {
            await deleteQuery(name);
            await loadSavedQueries();
            if (selectedSavedQuery === name) {
                setSelectedSavedQuery('');
            }
            setSuccessMessage(`Query "${name}" deleted successfully`);
        } catch (err) {
            setError('Failed to delete query: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleRenameQuery = async (oldName) => {
        if (!newQueryName.trim()) {
            setError('Please enter a new name');
            return;
        }

        try {
            await renameQuery(oldName, newQueryName);
            await loadSavedQueries();
            setRenamingQuery(null);
            setNewQueryName('');
            if (selectedSavedQuery === oldName) {
                setSelectedSavedQuery(newQueryName);
            }
            setSuccessMessage(`Query renamed to "${newQueryName}"`);
        } catch (err) {
            setError('Failed to rename query: ' + (err.response?.data?.detail || err.message));
        }
    };

    const copyColumnName = (colName) => {
        navigator.clipboard.writeText(colName);
        setSuccessMessage(`Column "${colName}" copied to clipboard`);
    };

    const copyTableName = (tableName) => {
        navigator.clipboard.writeText(tableName);
        setSuccessMessage(`Table "${tableName}" copied to clipboard`);
    };

    const toggleTableExpansion = (tableName) => {
        setExpandedTables(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tableName)) {
                newSet.delete(tableName);
            } else {
                newSet.add(tableName);
            }
            return newSet;
        });
    };

    const addQueryToMap = async () => {
        if (!queryResult) {
            setError('No query results to display on map');
            return;
        }

        setGeocoding(true);
        setError(null);

        try {
            const geojsonData = await geocodeDuckDBQuery(selectedDatabase, query);

            if (!geojsonData.features || geojsonData.features.length === 0) {
                setError('No geographic data found in query results. Make sure your query includes latitude/longitude or address columns.');
                setGeocoding(false);
                return;
            }

            // Create a layer name from query (first line, conditionally add ellipsis)
            const queryPreview = query.split('\n')[0];
            const layerName = queryPreview.length > 50
                  ? `Query ${sqlLayers.length + 1}: ${queryPreview.substring(0, 50)}...`
                  : `Query ${sqlLayers.length + 1}: ${queryPreview}`;

            const newLayer = {
                id: `sql-layer-${Date.now()}`,
                name: layerName,
                query: query, // Store full query for tooltip
                type: 'sql_result',
                data: geojsonData,
                color: selectedLayerColor,
                visible: true
            };

            setSqlLayers([...sqlLayers, newLayer]);
            setSuccessMessage(`Added ${geojsonData.features.length} points to map`);
        } catch (err) {
            console.error('Error geocoding query:', err);
            setError(`Failed to add query to map: ${err.response?.data?.detail || err.message}`);
        } finally {
            setGeocoding(false);
        }
    };

    const toggleSqlLayer = (layerId) => {
        setSqlLayers(sqlLayers.map(layer =>
            layer.id === layerId
                ? { ...layer, visible: !layer.visible }
            : layer
        ));
    };

    const removeSqlLayer = (layerId) => {
        setSqlLayers(sqlLayers.filter(layer => layer.id !== layerId));
    };

    const changeSqlLayerColor = (layerId, color) => {
        setSqlLayers(sqlLayers.map(layer =>
            layer.id === layerId
                ? { ...layer, color: color }
            : layer
        ));
    };

    const renameSqlLayer = (layerId, newName) => {
        if (!newName.trim()) {
            setError('Layer name cannot be empty');
            return;
        }
        setSqlLayers(sqlLayers.map(layer =>
            layer.id === layerId
                ? { ...layer, name: newName.trim() }
            : layer
        ));
        setRenamingLayer(null);
        setNewLayerName('');
        setSuccessMessage('Layer renamed successfully');
    };

    const exportToPDF = async () => {
        if (!queryResult) return;

        // Simple CSV export for now (PDF export would require more backend work)
        const csv = [
            queryResult.columns.join(','),
            ...queryResult.rows.map(row =>
                queryResult.columns.map(col => JSON.stringify(row[col] ?? '')).join(',')
            )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'query-results.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleGenerateChart = (config) => {
        // Use the query result data for the chart
        if (queryResult && queryResult.rows) {
            setChartData(queryResult.rows);
            setChartConfig(config);
            setShowChartConfig(false);
            setSuccessMessage('Chart generated successfully!');
        }
    };

    const handleCloseChart = () => {
        setChartData(null);
        setChartConfig(null);
    };

    const handleEditChart = () => {
        // Reopen config with current configuration
        setShowChartConfig(true);
    };

    const handleShowChartConfig = () => {
        setShowChartConfig(true);
        setChartData(null);
        setChartConfig(null);
    };

    const handleCloseChartConfig = () => {
        setShowChartConfig(false);
    };


    // Mémoïser le tableau des layers
    const allLayers = useMemo(() => {
        return [
            ...geoLayers,
            ...sqlLayers.filter(layer => layer.visible)
        ];
    }, [geoLayers, sqlLayers]);

    return (
        <div className="duck-page">
            <div className="duck-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>🦆 DuckDB SQL Explorer</h1>
                </div>
            </div>

            {/* Success message */}
            {successMessage && (
                <div className="success-message">
                    {successMessage}
                </div>
            )}

            {/* Delete confirmation dialog */}
            {showDeleteConfirm && (
                <div className="confirmation-overlay">
                    <div className="confirmation-dialog">
                        <h3>Delete Query</h3>
                        <p>Are you sure you want to delete the query "{showDeleteConfirm}"?</p>
                        <div className="confirmation-actions">
                            <button onClick={confirmDelete} className="btn-danger">
                                Delete
                            </button>
                            <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="duck-content">
                <div className="duck-left-panel">
                    {/* Database selector */}
                    <div className="duck-section">
                        <label htmlFor="database-select">Database:</label>
                        <select
                            id="database-select"
                            value={selectedDatabase}
                            onChange={(e) => setSelectedDatabase(e.target.value)}
                            className="duck-select"
                        >
                            <option value="">Select a database...</option>
                            {databases.map(db => (
                                <option key={db} value={db}>{db}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tables and columns display - shown after database selection */}
                    {selectedDatabase && tables.length > 0 && (
                        <div className="duck-section">
                            <h3>Available Tables & Columns:</h3>
                            {tables.map(table => {
                                const isExpanded = expandedTables.has(table.name);
                                return (
                                    <div key={table.name} className="table-info">
                                        <div className="table-header">
                                            <button
                                                onClick={() => toggleTableExpansion(table.name)}
                                                className="table-toggle-button"
                                                title="Click to expand/collapse columns"
                                            >
                                                {isExpanded ? '−' : '+'}
                                            </button>
                                            <button
                                                onClick={() => copyTableName(table.name)}
                                                className="table-name-button"
                                                title="Click to copy table name"
                                            >
                                                {table.name}
                                            </button>
                                        </div>
                                        {isExpanded && (
                                            <div className="columns-list">
                                                {table.columns.map(col => (
                                                    <button
                                                        key={`${table.name}.${col.name}`}
                                                        onClick={() => copyColumnName(`"${col.name}"`)}
                                                        className="column-button"
                                                        title={`${col.type} - Click to copy`}
                                                    >
                                                        {col.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Saved queries */}
                    <div className="duck-section">
                        <label htmlFor="saved-queries-select">Saved Queries:</label>
                        <select
                            id="saved-queries-select"
                            value={selectedSavedQuery}
                            onChange={(e) => {
                                setSelectedSavedQuery(e.target.value);
                                if (e.target.value) {
                                    handleLoadSavedQuery(e.target.value);
                                }
                            }}
                            className="duck-select"
                        >
                            <option value="">Select a saved query...</option>
                            {console.log("qhat", savedQueries)}{ Object.keys(savedQueries).map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>

                        {selectedSavedQuery && (
                            <div className="query-actions">
                                <button
                                    onClick={() => {
                                        setRenamingQuery(selectedSavedQuery);
                                        setNewQueryName(selectedSavedQuery);
                                    }}
                                    className="btn-secondary"
                                >
                                    Rename
                                </button>
                                <button
                                    onClick={() => handleDeleteQuery(selectedSavedQuery)}
                                    className="btn-danger"
                                >
                                    Delete
                                </button>
                            </div>
                        )}

                        {renamingQuery && (
                            <div className="rename-dialog">
                                <input
                                    type="text"
                                    value={newQueryName}
                                    onChange={(e) => setNewQueryName(e.target.value)}
                                    placeholder="New query name"
                                    className="duck-input"
                                />
                                <button onClick={() => handleRenameQuery(renamingQuery)} className="btn-primary">
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setRenamingQuery(null);
                                        setNewQueryName('');
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* SQL Query editor */}
                    <div className="duck-section">
                        <label>SQL Query:</label>
                        <SQLEditor
                            value={query}
                            onChange={setQuery}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="duck-section">
                        <div className="button-group">
                            <button
                                onClick={executeQuery}
                                disabled={loading || !selectedDatabase}
                                className="btn-primary"
                            >
                                {loading ? 'Executing...' : 'Execute Query'}
                            </button>

                            <button
                                onClick={() => setSavingQuery(!savingQuery)}
                                className="btn-secondary"
                            >
                                Save Query
                            </button>

                            {queryResult && (
                                <>
                                    <button onClick={exportToPDF} className="btn-secondary">
                                        Export CSV
                                    </button>

                                    <button
                                        onClick={handleShowChartConfig}
                                        className="btn-primary"
                                        style={{ backgroundColor: '#28a745' }}
                                    >
                                        📊 Visualize as Chart
                                    </button>

                                    <button
                                        onClick={addQueryToMap}
                                        disabled={geocoding}
                                        className="btn-primary"
                                        style={{ backgroundColor: selectedLayerColor }}
                                    >
                                        {geocoding ? 'Adding to Map...' : 'Add to Map'}
                                    </button>

                                    <input
                                        type="color"
                                        value={selectedLayerColor}
                                        onChange={(e) => setSelectedLayerColor(e.target.value)}
                                        title="Choose layer color"
                                        style={{ width: '50px', height: '38px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    />
                                </>
                            )}
                        </div>

                        {savingQuery && (
                            <div className="save-query-dialog">
                                <input
                                    type="text"
                                    value={queryName}
                                    onChange={(e) => setQueryName(e.target.value)}
                                    placeholder="Query name"
                                    className="duck-input"
                                />
                                <button onClick={handleSaveQuery} className="btn-primary">
                                    Save
                                </button>
                                <button onClick={() => setSavingQuery(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="duck-right-panel">
                    {/* Error display */}
                    {error && (
                        <div className="error-message">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Results display */}
                    {queryResult && (
                        <div className="results-section">
                            <h2>
                                Results ({queryResult.row_count} {queryResult.row_count === 1 ? 'row' : 'rows'}, {queryResult.columns.length} {queryResult.columns.length === 1 ? 'column' : 'columns'})
                                {queryResult.truncated && <span className="warning"> (Truncated to {queryResult.max_rows} rows)</span>}
                            </h2>

                            {/* Chart Configurator */}
                            {showChartConfig && (
                                <SimpleChartConfig
                                    columns={queryResult.columns}
                                    onGenerateChart={handleGenerateChart}
                                    onClose={handleCloseChartConfig}
                                    initialConfig={chartConfig}
                                />
                            )}

                            {/* Chart Display */}
                            {chartData && chartConfig && !showChartConfig && (
                                <SimpleChart
                                    data={chartData}
                                    config={chartConfig}
                                    onClose={handleCloseChart}
                                    onEdit={handleEditChart}
                                />
                            )}

                            {/* Results table */}
                            <div className="results-table-container">
                                <table className="results-table">
                                    <thead>
                                        <tr>
                                            {queryResult.columns.map(col => (
                                                <th key={col}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queryResult.rows.map((row, idx) => (
                                            <tr key={idx}>
                                                {queryResult.columns.map(col => (
                                                    <td key={col}>
                                                        {row[col] !== null && row[col] !== undefined
                                                         ? String(row[col])
                                                         : 'NULL'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!queryResult && !error && !loading && (
                        <div className="placeholder">
                            <p>Execute a query to see results here.</p>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                Tip: Try <code>SELECT * FROM energy_data LIMIT 10</code>
                            </p>
                        </div>
                    )}

                    {/* Map Section */}
                    <div className="map-section" style={{ marginTop: '2rem' }}>
                        <h2>Interactive Map</h2>

                        {/* Geographic Dataset Layers */}
                        <DatasetLayerSelector onLayersChange={setGeoLayers} />

                        {/* SQL Result Layers */}
                        {sqlLayers.length > 0 && (
                            <div className="sql-layers-control" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                <h3>SQL Result Layers</h3>
                                <div className="sql-layers-list">
                                    {sqlLayers.map(layer => (
                                        <div key={layer.id}>
                                            <div className="sql-layer-item" style={{
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     gap: '0.5rem',
                                                     padding: '0.5rem',
                                                     backgroundColor: '#f8f9fa',
                                                     borderRadius: '4px',
                                                     marginBottom: renamingLayer === layer.id ? '0' : '0.5rem'
                                                 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={layer.visible}
                                                    onChange={() => toggleSqlLayer(layer.id)}
                                                />
                                                <input
                                                    type="color"
                                                    value={layer.color}
                                                    onChange={(e) => changeSqlLayerColor(layer.id, e.target.value)}
                                                    style={{ width: '30px', height: '30px', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                                />
                                                <span
                                                    style={{ flex: 1, fontSize: '0.9rem', cursor: 'help' }}
                                                    title={layer.query}
                                                >
                                                    {layer.name}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setRenamingLayer(layer.id);
                                                        setNewLayerName(layer.name);
                                                    }}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => removeSqlLayer(layer.id)}
                                                    className="btn-danger"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            {renamingLayer === layer.id && (
                                                <div style={{
                                                         padding: '0.5rem',
                                                         backgroundColor: '#e9ecef',
                                                         borderRadius: '4px',
                                                         marginBottom: '0.5rem',
                                                         display: 'flex',
                                                         gap: '0.5rem',
                                                         alignItems: 'center'
                                                     }}>
                                                    <input
                                                        type="text"
                                                        value={newLayerName}
                                                        onChange={(e) => setNewLayerName(e.target.value)}
                                                        placeholder="New layer name"
                                                        className="duck-input"
                                                        style={{ flex: 1 }}
                                                        autoFocus
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                renameSqlLayer(layer.id, newLayerName);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => renameSqlLayer(layer.id, newLayerName)}
                                                        className="btn-primary"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setRenamingLayer(null);
                                                            setNewLayerName('');
                                                        }}
                                                        className="btn-secondary"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <DistanceCalculator
                            layers={allLayers}
                            onMatchesChange={handleMatchesChange}
                            onFocusCoordinates={handleFocusCoordinates}
                        />
                        {/* Map Display */}
                        <div style={{
                                 border: '1px solid #ddd',
                                 borderRadius: '4px',
                                 overflow: 'hidden',
                                 height: '500px'
                             }}>
                            {/* Distance Calculator */}

                            <MapComponent
                                geojsonData={[
                                    ...geoLayers,
                                    ...sqlLayers.filter(layer => layer.visible)
                                ]}
                                distanceMatches={distanceMatches}
                                showNonMatches={showNonMatches}
                                focusCoordinates={focusCoordinates}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DuckPage;
