/**
 * Calculate the Haversine distance between two GPS coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Extract coordinates from a GeoJSON feature
 * @param {Object} feature - GeoJSON feature
 * @returns {Object|null} { lat, lon } or null if not a point
 */
export function extractCoordinates(feature) {
  if (feature.geometry.type === 'Point') {
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon };
  }
  return null;
}

/**
 * Calculate all matches between two layers within a distance threshold
 * @param {Array} layer1Features - Features from first layer
 * @param {Array} layer2Features - Features from second layer
 * @param {number} thresholdMeters - Distance threshold in meters
 * @returns {Array} Array of match objects with point pairs and distances
 */
export function calculateMatches(layer1Features, layer2Features, thresholdMeters) {
  const matches = [];
  
  // Extract point features only
  const points1 = layer1Features
    .map((feature, idx) => ({ feature, idx, coords: extractCoordinates(feature) }))
    .filter(p => p.coords !== null);
  
  const points2 = layer2Features
    .map((feature, idx) => ({ feature, idx, coords: extractCoordinates(feature) }))
    .filter(p => p.coords !== null);
  
  // Calculate distances between all pairs
  for (const p1 of points1) {
    for (const p2 of points2) {
      const distance = haversineDistance(
        p1.coords.lat, p1.coords.lon,
        p2.coords.lat, p2.coords.lon
      );
      
      if (distance <= thresholdMeters) {
        matches.push({
          point1: p1.feature,
          point2: p2.feature,
          point1Index: p1.idx,
          point2Index: p2.idx,
          distance: distance,
          coords1: p1.coords,
          coords2: p2.coords
        });
      }
    }
  }
  
  return matches;
}

/**
 * Export matches to CSV format
 * @param {Array} matches - Array of match objects
 * @param {string} layer1Name - Name of first layer
 * @param {string} layer2Name - Name of second layer
 * @returns {string} CSV content
 */
export function exportMatchesToCSV(matches, layer1Name, layer2Name) {
  if (matches.length === 0) {
    return 'No matches found';
  }
  
  // Collect all unique property keys from all matches
  const allProps1Keys = new Set();
  const allProps2Keys = new Set();
  
  matches.forEach(match => {
    Object.keys(match.point1.properties || {}).forEach(key => allProps1Keys.add(key));
    Object.keys(match.point2.properties || {}).forEach(key => allProps2Keys.add(key));
  });
  
  // Build header
  const header = [
    'Distance_m'
  ];

  let enedis_point1 = false;
  let enedis_point2 = false;
  
  // Add property columns for all unique keys
  allProps1Keys.forEach(key => {
    header.push(`${key}`);
    if(key === "Adresse") {
        enedis_point1 = true;
    }
  });
  
  allProps2Keys.forEach(key => {
    header.push(`${key}`);
    if(key === "Adresse") {
        enedis_point2 = true;
    }
  });

  if(enedis_point1 || enedis_point2) {
      header.push("Enedis Latitude");
      header.push("Enedis Longitude");
  }
  
  // Build rows
  const rows = matches.map((match, idx) => {
    const row = [match.distance.toFixed(2)];

    // Add properties from point1
    allProps1Keys.forEach(key => {
      const value = match.point1.properties?.[key] ?? '';
      row.push(typeof value === 'string' && value.includes(',') ? `"${value}"` : value);
    });
    
    // Add properties from point2
    allProps2Keys.forEach(key => {
      const value = match.point2.properties?.[key] ?? '';
      row.push(typeof value === 'string' && value.includes(',') ? `"${value}"` : value);
    });

    if(enedis_point1) {
        row.push(match.coords1.lat.toFixed(6));
        row.push(match.coords1.lon.toFixed(6));
    }

    if(enedis_point2) {
        row.push(match.coords2.lat.toFixed(6));
        row.push(match.coords2.lon.toFixed(6));
      }

    
    return row.join(',');
  });
  
  return [header.join(','), ...rows].join('\n');
}

function get_table_from_layer(layer) {
    const regex = /FROM\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_\.]+))/i;
    const match = layer.query.match(regex);

    if (match) {
        return match[1] || match[2] || match[3];
    }

    return null;
}

/**
 * Export matches to JSON format for backend request
 * @param {Array} matches - Array of match objects
 * @param {string} layer1Name - Name of first layer
 * @param {string} layer2Name - Name of second layer
 * @returns {string} JSON content
 */
export function exportMatchesToPayload(matches, layer1, layer2) {

    const export_data = {
        metadata : {
            table1: get_table_from_layer(layer1),
            table2: get_table_from_layer(layer2)
        },
        matches: matches.map((match, _) => ({
            point1: {
                longitude: match.coords1.lon.toFixed(6),
                latitude: match.coords1.lat.toFixed(6),
                properties: match.point1.properties
            },
            point2: {
                longitude: match.coords2.lon.toFixed(6),
                latitude: match.coords2.lat.toFixed(6),
                properties: match.point2.properties
            },
            distance: {
                meters: parseFloat(match.distance.toFixed(2)),
                kilometers: parseFloat((match.distance / 1000).toFixed(3))
            }
        }))
    };

    console.log(export_data);

  return JSON.stringify(export_data);
}
