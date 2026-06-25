import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, GeoJSON, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapComponent.css';
import PopupChart from './PopupChart';
import { detectNumericColumns } from './popupChartUtils';

// Fix for default marker icons in React-Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let defaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

// Component to auto-fit map bounds
function FitBounds({ geojsonData }) {
  const map = useMap();
  
  useEffect(() => {
    if (geojsonData && geojsonData.length > 0) {
      const allFeatures = geojsonData.flatMap(d => d.data.features || []);
      if (allFeatures.length > 0) {
        const geoJsonLayer = L.geoJSON(allFeatures);
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [geojsonData, map]);
  
  return null;
}

// Component to focus map on specific coordinates
function FocusOnCoordinates({ focusCoordinates }) {
  const map = useMap();
  
  useEffect(() => {
    if (focusCoordinates && focusCoordinates.lat && focusCoordinates.lon) {
      const zoom = focusCoordinates.zoom || 16;
      map.setView([focusCoordinates.lat, focusCoordinates.lon], zoom);
    }
  }, [focusCoordinates, map]);
  
  return null;
}

const MapComponent = ({ geojsonData = [], distanceMatches = [], showNonMatches = false, focusCoordinates = null }) => {
  const mapRef = useRef(null);
  
  // Coordinate comparison threshold for floating point precision
  const COORDINATE_EPSILON = 0.000001;
  
  // Helper to check if a point should be shown based on distance matches
  const shouldShowPoint = (geometry, distanceMatches, showNonMatches) => {
    if (distanceMatches.length === 0) {
      // No filtering - show all points
      return true;
    }
    
    // Check if this point is part of any match
    if (geometry.type !== 'Point') {
      return true; // Don't show non-point features when filtering
    }
    
    const [lon, lat] = geometry.coordinates;
    
    const isMatched = distanceMatches.some(match => {
      // Check if point matches coords1 or coords2
      const matchesCoords1 = 
        Math.abs(match.coords1.lat - lat) < COORDINATE_EPSILON && 
        Math.abs(match.coords1.lon - lon) < COORDINATE_EPSILON;
      
      const matchesCoords2 = 
        Math.abs(match.coords2.lat - lat) < COORDINATE_EPSILON && 
        Math.abs(match.coords2.lon - lon) < COORDINATE_EPSILON;
      
      return matchesCoords1 || matchesCoords2;
    });
    
    // If showNonMatches is true, invert the logic
    return showNonMatches ? !isMatched : isMatched;
  };
  
  // Style function for different layers
  const getFeatureStyle = (feature, datasetIndex, dataset) => {
    const colors = [
      '#3388ff', // Blue
      '#ff7800', // Orange
      '#22cc88', // Green
      '#cc2288', // Pink
      '#8822cc', // Purple
      '#cccc22', // Yellow
    ];
    
    // Use custom color for SQL result layers
    let color;
    if (dataset?.type === 'sql_result' && dataset?.color) {
      color = dataset.color;
    } else if (dataset?.type === 'filtered') {
      color = '#ff0000';
    } else {
      color = colors[datasetIndex % colors.length];
    }
    
    if (feature.geometry.type === 'Point') {
      return {};
    }
    
    return {
      color: color,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3
    };
  };

  // Point to layer for point features
  const pointToLayer = (feature, latlng, datasetIndex, dataset) => {
    const colors = [
      '#3388ff', '#ff7800', '#22cc88', '#cc2288', '#8822cc', '#cccc22'
    ];
    
    // Use custom color for SQL result layers
    let color;
    if (dataset?.type === 'sql_result' && dataset?.color) {
      color = dataset.color;
    } else if (dataset?.type === 'filtered') {
      color = '#ff0000';
    } else {
      color = colors[datasetIndex % colors.length];
    }
    
    return L.circleMarker(latlng, {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });
  };

  // Helper function to create a unique geometry identifier
  const getGeometryKey = (geometry) => {
    return JSON.stringify(geometry);
  };

  // Helper function to group features by geometry
  const groupFeaturesByGeometry = (datasets, distanceMatches, showNonMatches) => {
    const geometryMap = new Map();
    
    datasets.forEach((dataset, datasetIndex) => {
      const features = dataset.data.features || [];
      
      features.forEach(feature => {
        // Filter based on distance matches
        if (!shouldShowPoint(feature.geometry, distanceMatches, showNonMatches)) {
          return; // Skip this feature
        }
        
        const geomKey = getGeometryKey(feature.geometry);
        
        if (!geometryMap.has(geomKey)) {
          geometryMap.set(geomKey, {
            geometry: feature.geometry,
            datasetIndex: datasetIndex,
            dataset: dataset,
            properties: []
          });
        }
        
        geometryMap.get(geomKey).properties.push(feature.properties);
      });
    });
    
    return geometryMap;
  };

  // Generate popup content with tabs for multiple years/entries
  const createPopupContent = (propertiesArray) => {
    // Detect numeric columns for chart
    const numericColumns = detectNumericColumns(propertiesArray);
    const hasMultipleEntries = propertiesArray.length > 1;
    const showChart = hasMultipleEntries && numericColumns.length > 0;
    
    if (propertiesArray.length === 1) {
      // Single entry - simple display
      const properties = propertiesArray[0];
      return Object.entries(properties)
        .map(([key, value]) => {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          return `<strong>${formattedKey}:</strong> ${value}`;
        })
        .join('<br/>');
    } else {
      // Multiple entries - tabbed display
      let html = '<div class="popup-tabs">';
      
      // Add chart section if numeric columns exist
      if (showChart) {
        html += '<div class="popup-chart-section" style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">';
        html += '<div style="margin-bottom: 10px;">';
        html += '<label style="font-weight: bold; margin-right: 10px;">Graphique:</label>';
        html += '<select class="chart-column-selector" style="padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px;">';
        
        numericColumns.forEach((col, idx) => {
          const formattedName = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          html += `<option value="${col}" ${idx === 0 ? 'selected' : ''}>${formattedName}</option>`;
        });
        
        html += '</select>';
        html += '<select class="chart-type-selector" style="margin-left: 10px; padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px;">';
        html += '<option value="line">Courbe</option>';
        html += '<option value="bar">Barres</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="chart-container"></div>';
        html += '</div>';
      }
      
      // Try to identify a year field for tab labels
      const yearFields = ['year', 'année', 'annee', 'date'];
      let yearField = null;
      
      for (const field of yearFields) {
        if (propertiesArray[0] && propertiesArray[0][field] !== undefined) {
          yearField = field;
          break;
        }
      }
      
      // Create tabs
      html += '<div class="tab-buttons" style="margin-bottom: 10px; border-bottom: 2px solid #ddd;">';
      propertiesArray.forEach((props, idx) => {
        const label = yearField && props[yearField] 
          ? props[yearField] 
          : `Entrée ${idx + 1}`;
        html += `<button class="tab-btn" data-tab="${idx}" style="padding: 5px 10px; margin-right: 5px; border: 1px solid #ddd; background: ${idx === 0 ? '#007bff' : '#f5f5f5'}; color: ${idx === 0 ? '#fff' : '#000'}; cursor: pointer; border-radius: 3px 3px 0 0;">${label}</button>`;
      });
      html += '</div>';
      
      // Create tab content
      propertiesArray.forEach((properties, idx) => {
        html += `<div class="tab-content" data-tab="${idx}" style="display: ${idx === 0 ? 'block' : 'none'};">`;
        html += Object.entries(properties)
          .map(([key, value]) => {
            const formattedKey = key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase());
            return `<div style="margin: 5px 0;"><strong>${formattedKey}:</strong> ${value}</div>`;
          })
          .join('');
        html += '</div>';
      });
      
      html += '</div>';
      
      return html;
    }
  };

  // Setup tab switching handlers and chart rendering when popup opens
  const setupPopupInteractivity = (layer, propertiesArray) => {
    layer.on('popupopen', () => {
      const popup = layer.getPopup();
      const popupElement = popup.getElement();
      
      if (popupElement) {
        // Setup tab switching
        const buttons = popupElement.querySelectorAll('.tab-btn');
        const contents = popupElement.querySelectorAll('.tab-content');
        
        buttons.forEach(btn => {
          btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Update button styles
            buttons.forEach(b => {
              b.style.background = '#f5f5f5';
              b.style.color = '#000';
            });
            this.style.background = '#007bff';
            this.style.color = '#fff';
            
            // Show corresponding content
            contents.forEach(content => {
              content.style.display = content.getAttribute('data-tab') === tabId ? 'block' : 'none';
            });
          });
        });
        
        // Setup chart rendering
        const chartContainer = popupElement.querySelector('.chart-container');
        const columnSelector = popupElement.querySelector('.chart-column-selector');
        const typeSelector = popupElement.querySelector('.chart-type-selector');
        
        if (chartContainer && columnSelector && typeSelector) {
          let chartRoot = null;
          
          const renderChart = () => {
            const selectedColumn = columnSelector.value;
            const chartType = typeSelector.value;
            
            // Clean up previous render
            if (chartRoot) {
              chartRoot.unmount();
            }
            
            // Clear container
            chartContainer.innerHTML = '';
            
            // Create new root and render
            chartRoot = createRoot(chartContainer);
            chartRoot.render(
              <PopupChart 
                propertiesArray={propertiesArray}
                selectedColumn={selectedColumn}
                chartType={chartType}
              />
            );
          };
          
          // Initial render
          renderChart();
          
          // Update on selector change
          columnSelector.addEventListener('change', renderChart);
          typeSelector.addEventListener('change', renderChart);
          
          // Cleanup on popup close
          layer.once('popupclose', () => {
            if (chartRoot) {
              chartRoot.unmount();
            }
            // Remove event listeners to prevent memory leaks
            columnSelector.removeEventListener('change', renderChart);
            typeSelector.removeEventListener('change', renderChart);
          });
        }
      }
    });
  };

  return (
    <div className="map-container">
      <MapContainer
        ref={mapRef}
        center={[46.603354, 1.888334]}
        zoom={6}
        style={{ height: '500px', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {(() => {
          // Group features by geometry, filtering by distance matches
          const geometryMap = groupFeaturesByGeometry(geojsonData, distanceMatches, showNonMatches);
          const uniqueFeatures = [];
          
          geometryMap.forEach((data) => {
            uniqueFeatures.push({
              type: 'Feature',
              geometry: data.geometry,
              properties: data.properties, // Array of properties
              datasetIndex: data.datasetIndex,
              dataset: data.dataset
            });
          });
          
          // Create a GeoJSON FeatureCollection
          const mergedData = {
            type: 'FeatureCollection',
            features: uniqueFeatures
          };
          
          return (
            <GeoJSON
                key={`merged-${geojsonData.map(d => d.id).join('-')}-${distanceMatches.length}-${showNonMatches}`}
              data={mergedData}
              style={(feature) => getFeatureStyle(feature, feature.datasetIndex, feature.dataset)}
              pointToLayer={(feature, latlng) => pointToLayer(feature, latlng, feature.datasetIndex, feature.dataset)}
              onEachFeature={(feature, layer) => {
                if (feature.properties && Array.isArray(feature.properties)) {
                  const popupContent = createPopupContent(feature.properties);
                  layer.bindPopup(popupContent, { maxWidth: 500 });
                  
                  // Setup interactivity (tabs and charts) if there are multiple entries
                  if (feature.properties.length > 1) {
                    setupPopupInteractivity(layer, feature.properties);
                  }
                }
              }}
            />
          );
        })()}
        
        {/* Render distance match lines */}
        {distanceMatches.map((match, idx) => {
          const positions = [
            [match.coords1.lat, match.coords1.lon],
            [match.coords2.lat, match.coords2.lon]
          ];
          return (
            <Polyline
              key={`match-${idx}`}
              positions={positions}
              pathOptions={{
                color: '#ff0066',
                weight: 2,
                opacity: 0.6,
                dashArray: '5, 5'
              }}
            />
          );
        })}
        
        <FitBounds geojsonData={geojsonData} />
        <FocusOnCoordinates focusCoordinates={focusCoordinates} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
