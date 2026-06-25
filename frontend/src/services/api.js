import axios from "axios";

// Load API base URL from config file
let API_BASE_URL = "http://127.0.0.1:8000"; // Default fallback

// Fetch config on module load
const loadConfig = async () => {
  try {
    const response = await fetch('/config.json');
    const config = await response.json();
    API_BASE_URL = config.API_BASE_URL || API_BASE_URL;
  } catch (error) {
    console.warn('Could not load config.json, using default API URL:', API_BASE_URL);
    console.warn('Config load error details:', error);
    if (!(error instanceof TypeError || error instanceof SyntaxError)) {
      throw error;
    }
  }
};

// Initialize config
await loadConfig();

export const fetchGeoDatasets = async () => {
  const response = await axios.get(`${API_BASE_URL}/datasets/geo/`);
  return response.data.datasets;
};

export const fetchGeoDatasetById = async (datasetId) => {
  const response = await axios.get(`${API_BASE_URL}/datasets/geo/${datasetId}`);
  return response.data;
};

// DuckDB API functions
export const fetchDuckDBDatabases = async () => {
  const response = await axios.get(`${API_BASE_URL}/duck/databases`);
  return response.data.databases;
};

export const fetchDuckDBTables = async (database) => {
  const response = await axios.get(`${API_BASE_URL}/duck/${database}/tables`);
  return response.data.tables;
};

export const executeDuckDBQuery = async (database, query) => {
  const response = await axios.post(`${API_BASE_URL}/duck/query`, {
    database,
    query
  });
  return response.data;
};

export const fetchSavedQueries = async () => {
  const response = await axios.get(`${API_BASE_URL}/duck/saved-queries`);
  return response.data.queries;
};

export const saveQuery = async (name, database, query) => {
  const response = await axios.post(`${API_BASE_URL}/duck/saved-queries`, {
    name,
    database,
    query
  });
  return response.data;
};

export const renameQuery = async (oldName, newName) => {
  const response = await axios.put(`${API_BASE_URL}/duck/saved-queries/${oldName}`, {
    old_name: oldName,
    new_name: newName
  });
  return response.data;
};

export const deleteQuery = async (name) => {
  const response = await axios.delete(`${API_BASE_URL}/duck/saved-queries/${name}`);
  return response.data;
};

export const getDuckDBColumns = async (database, query = null, table = null) => {
  const response = await axios.post(`${API_BASE_URL}/duck/columns`, {
    database,
    query,
    table
  });
  return response.data.columns;
};

export const geocodeDuckDBQuery = async (database, query) => {
  const response = await axios.post(`${API_BASE_URL}/duck/geocode`, {
    database,
    query
  });
  return response.data;
};

export const importMatchesToDB = async (database, table, payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/import-matches-to-db`, {
    database,
    table,
    payload: payload
  });

    return response.data;
};
