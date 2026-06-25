import { Application, Router, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import * as Path from "jsr:@std/path";
import { exists } from "jsr:@std/fs/exists";
import { GeoDatasetInfo,
         GeoDatasets,
         GeocodedAddress,
         DuckDBQueryRequest, DuckDBColumnsRequest,
         SavedQuery, RenameQuery,
         ImportMatchesRequest, Payload } from './src/types.ts';

import { build_query } from "./src/import_query_builder.ts";
import { DuckDBManager } from './src/duckdb_manager.ts';

const GEO_DATASETS_DIR: string = "./datasets/geo";
const DUCKDB_DIR: string = "./datasets";
const MAX_RESULT_ROWS = 10000;
const SAVED_QUERIES_FILE: string = "./datasets/saved_queries.json";
const SAVED_QUERIES = await load_saved_queries();

const duck_manager : DuckDBManager = new DuckDBManager;

let geocodingCache: { [key: string]: GeocodedAddress } = {};
const GEOCODING_CACHE_FILE = "./geocoding_cache.json";

loadGeocodingCache().catch(console.error);

const router = new Router();
router.get("/datasets/geo", (ctx: RouterContext<string>) => list_geo_datasets(ctx));
router.get("/datasets/geo/:id", (ctx: RouterContext<string>) => get_geo_datasets(ctx, ctx?.params?.id));
router.get("/duck/databases", (ctx: RouterContext<string>) => list_duckdb_databases(ctx));
router.get("/duck/:db/tables", (ctx: RouterContext<string>) => list_duckdb_tables(ctx, ctx?.params?.db));
router.post("/duck/columns", async (ctx: RouterContext<string>) => get_duckdb_columns(ctx, await ctx.request.body.json()));
router.post("/duck/query", async (ctx: RouterContext<string>) => execute_duckdb_query(ctx, await ctx.request.body.json()));
router.get("/duck/saved-queries", (ctx: RouterContext<string>) => list_saved_queries(ctx));
router.post("/duck/saved-queries", async (ctx: RouterContext<string>) => save_query(ctx, await ctx.request.body.json()));
router.put("/duck/saved-queries/:name",
           async (ctx: RouterContext<string>) => rename_query(ctx, ctx.params.name, await ctx.request.body.json()));
router.delete("/duck/saved-queries/:name", (ctx: RouterContext<string>) => delete_query(ctx, ctx.params.name));
router.post("/duck/geocode", async (ctx: RouterContext<string>) => geocode_duckdb_results(ctx, await ctx.request.body.json()));
router.post("/api/import-matches-to-db", (ctx: RouterContext<string>) => import_matches_to_db(ctx));

const app = new Application();
app.use(async (context: RouterContext<string>, next: any) => {
  try {
    await context.send({
      root: `${Deno.cwd()}/../frontend/dist`,
      index: "index.html",
    });
  } catch {
    await next();
  }
});
app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({
    port: 8000,
    secure: true,
    cert: await Deno.readTextFile("./ssl/cert.pem"),
    key: await Deno.readTextFile("./ssl/key.pem"),
});

async function loadGeocodingCache() {
    if (await exists(GEOCODING_CACHE_FILE)) {
        const data = await Deno.readTextFile(GEOCODING_CACHE_FILE);
        geocodingCache = JSON.parse(data);
    }
}

async function saveGeocodingCache() {
    try {
        await Deno.writeTextFile(GEOCODING_CACHE_FILE, JSON.stringify(geocodingCache));
    } catch (e) {
        console.error(`Erreur lors de la sauvegarde du cache de géocodage: ${e}`);
    }
}

async function list_geo_datasets(ctx: RouterContext<string>) {
    const datasets: GeoDatasets = [];

    for await(const file of Deno.readDir(GEO_DATASETS_DIR)) {
        if(!file.isFile) continue;
        if(!file.name.endsWith(".geojson")) continue;

        const info: GeoDatasetInfo = {
            id: file.name,
            name: file.name,
            filename: file.name
        };

        datasets.push(info);
    }

    ctx.response.body = { datasets };
}

async function get_geo_datasets(ctx: RouterContext<string>, id: string) {
    const p = Path.join(GEO_DATASETS_DIR, id);

    if (!await exists(p)) {
        ctx.throw(404);
    }

    const data = await Deno.readTextFile(p);
    ctx.response.body = JSON.parse(data);
}

async function list_duckdb_databases(ctx: RouterContext<string>) {
    const databases = [];

    for await (const file of Deno.readDir(DUCKDB_DIR)) {
        if(file.name.endsWith(".db")) databases.push(file.name);
    }

    ctx.response.body = { databases };
}

async function list_duckdb_tables(ctx: RouterContext<string>, database: string) {
    const dbpath = Path.join(DUCKDB_DIR, database);

    if(!await exists(dbpath)) ctx.throw(404);

    const tables = await duck_manager.get_tables(dbpath);

    ctx.response.body = { tables: tables };
}

async function execute_duckdb_query(ctx: RouterContext<string>, request: DuckDBQueryRequest) {

    if(!request.database) ctx.throw(400, "You did not provide a database");
    if(!request.query) ctx.throw(400, "You did not provide a SQL query");

    const dbpath = Path.join(DUCKDB_DIR, request.database);

    if(!await exists(dbpath)) ctx.throw(404);

    try {
        const reader = await duck_manager.execute(dbpath, request.query);
        const data = reader.getRowObjectsJson();

        ctx.response.body = {
            "success": true,
            "columns": reader.columnNames(),
            "rows": data,
            "row_count": data.length,
            "truncated": false,
            "max_rows": MAX_RESULT_ROWS
        }
    } catch(error: any) {
        ctx.throw(400, error.message);
    }
}

async function get_duckdb_columns(ctx: RouterContext<string>, request: DuckDBColumnsRequest) {
    const dbpath = Path.join(DUCKDB_DIR, request.database);

    if (!await exists(dbpath)) ctx.throw(404, `Database not found: ${request.database}`);

    try {
        if (request.query) {
            const columns = await duck_manager.get_columns_from_query(dbpath, request.query);
            ctx.response.body = { columns: columns };
        } else if (request.table) {
            const columns = await duck_manager.get_table_columns(dbpath, request.table);
            ctx.response.body = { columns: columns };
        } else {
            ctx.throw(400, "No query or table specified in request");
        }
    } catch (error: any) {
        console.error(`Error getting columns: ${error}`);
        ctx.throw(500, error.message);
    }
}

async function geocode_address(address: string, city: string | undefined, postal_code:string | undefined) : Promise<GeocodedAddress | undefined> {
    const cache_key = `${address}|${city}|${postal_code}`;

    if (geocodingCache[cache_key]) {
        return geocodingCache[cache_key];
    }

    let full_address = address;
    if(city) full_address = `${full_address} ${city}`;
    if(postal_code) full_address = `${full_address} ${postal_code}`;

    const params = new URLSearchParams({
        q: full_address,
        limit: "1",
    }).toString();

    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`);

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const data: any = await response.json();

    if(data.features && data.features.length > 0) {
        const feature = data.features[0];
        const coords = feature.geometry.coordinates;
        const result: GeocodedAddress = {
            longitude: coords[0],
            latitude: coords[1],
            label: feature.properties.label ?? full_address
        }

        geocodingCache[cache_key] = result;
        saveGeocodingCache().catch(console.error);

        return result;
    }
}

async function geocode_duckdb_results(ctx: RouterContext<string>, request: DuckDBQueryRequest) {

    await execute_duckdb_query(ctx, request);
    const response: any = ctx.response.body;
    ctx.response.body = null;

    if(!response) ctx.throw(500);

    try {
        const data: any = response.rows;
        const columns: any = response.columns;

        if (!data) {
            ctx.response.body = {
                type: "FeatureCollection",
                features: []
            };
            return;
        }

        const features: any[] = [];

        const column_map : Map<string, string> = new Map();
        for(const col of columns) {
            column_map.set(col.toLowerCase(), col);
        }

        for (const row of data) {
            let lat: number | null = null;
            let lon: number | null = null;

            if(column_map.has('géo-shape iris')) {
                const col = column_map.get('géo-shape iris') as string;

                const shapes = JSON.parse(row[col]);
                delete row[col];

                features.push({
                    type: "Feature",
                    geometry: shapes,
                    properties: row
                });
            }

            if(column_map.has('géo-point iris')) {
                const col  = column_map.get('géo-point iris') as string;
                const latlon = row[col].split(",");
                lat = Number.parseFloat(latlon[0]);
                lon = Number.parseFloat(latlon[1]);

                console.log(lat, lon, latlon);
            }

            // Try to get coordinates from lat/lon columns
            for (const possible_lat of ['lat', 'latitude', 'y']) {
                if (column_map.has(possible_lat)) {
                    lat = parseFloat(row[column_map.get(possible_lat) as string]);
                    break;
                }
            }
            for (const possible_lon of ['lon', 'lng', 'longitude', 'x']) {
                if (column_map.has(possible_lon)) {
                    lon = parseFloat(row[column_map.get(possible_lon) as string]);
                    break;
                }
            }

            // If no coordinates, try geocoding address/city
            if (lat === null || lon === null) {
                const address_col = column_map.get('address') || column_map.get('adresse') || column_map.get('addr') || column_map.get('location');
                const city_col = column_map.get('city') || column_map.get('ville') || column_map.get('commune') || column_map.get('nom commune');
                const postal_code_col = column_map.get('postal_code') || column_map.get('code_postal') || column_map.get('zipcode') || column_map.get('zip');

                let address, city, postal_code;

                if(address_col)     address = row[address_col];
                if(city_col)        city = row[city_col];
                if(postal_code_col) postal_code = row[postal_code_col];

                if (address || city) {
                    const coords = await geocode_address(address, city, postal_code);
                    if (coords) {
                        lat = parseFloat(coords.latitude);
                        lon = parseFloat(coords.longitude);
                    }
                }
            }

            // If we have valid coordinates, add to features
            if (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                features.push({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [lon, lat]
                    },
                    properties: row
                });
            }
        }

        ctx.response.body = {
            type: "FeatureCollection",
            features: features
        };

    } catch (error: any) {
        ctx.throw(500, `Error geocoding DuckDB results: ${error.message}`);
    }
}


async function load_saved_queries() {
    if (await exists(SAVED_QUERIES_FILE)) {
        const data = await Deno.readTextFile(SAVED_QUERIES_FILE);
        return JSON.parse(data);
    }

    return {};
}

function save_queries(): void {
    Deno.writeTextFile(SAVED_QUERIES_FILE, JSON.stringify(SAVED_QUERIES));
}

function list_saved_queries(ctx: RouterContext<string>) {
    ctx.response.body = { queries: SAVED_QUERIES };
}

function save_query(ctx: RouterContext<string>, query: SavedQuery): void {
    if(!query.name) ctx.throw(400, "A query name is required. Please provide a name for your query.")
    if(!query.database) ctx.throw(400, "A database name is required. please provide a database name.")
    if(!query.query) ctx.throw(400, "A query string is required. Please provide a query.")
    
    if(SAVED_QUERIES[query.name]) {
        ctx.throw(400, "A saved query already exists with this name. Please use a different name.")
    }

    SAVED_QUERIES[query.name] = {
        database: query.database,
        query: query.query
    };

    save_queries();
    ctx.response.body = { success: true, message: `Query ${query.name} saved successfully.` };
}

function rename_query(ctx: RouterContext<string>, old_name:string, new_name_query: RenameQuery) {
    const new_name = new_name_query.new_name;

    if(!new_name) ctx.throw(400, "A new name is required. Please provide a new name for your query.")
    if(!SAVED_QUERIES[old_name]) ctx.throw(400, "Saved Query does not exist with the provided name.")

    if(SAVED_QUERIES[new_name]) {
        ctx.throw(400, "A saved query already exists with this new name. Please use a different name.")
    }

    const temp = SAVED_QUERIES[old_name];
    delete SAVED_QUERIES[old_name];
    SAVED_QUERIES[new_name] = {
        database: temp.database,
        query: temp.query
    }
    save_queries();
    ctx.response.body = { success: true, message: `Query ${old_name} has been renamed successfully to ${new_name}` };
}

function delete_query(ctx: RouterContext<string>, name: string) {
    if(!SAVED_QUERIES[name]) ctx.throw(404, `A saved query with the name ${name} does not exist.`)

    delete SAVED_QUERIES[name];
    save_queries();
    ctx.response.body = { success: true, message: `Query ${name} deleted successfully.` };
}

async function import_matches_to_db(ctx: RouterContext<string>) {

    const request: ImportMatchesRequest = await ctx.request.body.json() as ImportMatchesRequest;

    // check request
    if(!request.database) ctx.throw(400, "No database provided");
    if(!request.table) ctx.throw(400, "No table provided");
    if(!request.payload) ctx.throw(400, "No payload provided");

    const db_path = Path.join(DUCKDB_DIR, request.database);

    if (!await exists(db_path)) {
        ctx.throw(404, `Database ${request.database} not found`);
    }

    const payload: Payload = JSON.parse(request.payload);
    if(payload && payload.matches && !payload.metadata) ctx.throw(400, "Found matches but no metadata");

    let table_exists = await duck_manager.table_exists(db_path, request.table);

    for(const match of payload.matches) {
        const query_result = build_query(match, payload.metadata);
        if(query_result.isOk()) {
            const sub_query = query_result.unwrap();
            let query = `INSERT INTO ${request.table} BY NAME (${sub_query})`;

            if(!table_exists) {
                table_exists = true;
                query = `CREATE TABLE ${request.table} AS ${sub_query}`;
            }

            try {
                await duck_manager.execute(db_path, query);
            } catch(error: any) {
                ctx.throw(500, error.message);
            }
        }
        else {
            ctx.throw(400, query_result.get_err()?.message);
        }
    }

    try {
        const row_count = await duck_manager.count_rows(db_path, request.table);

        ctx.response.body = {
            success: true,
            message: `Data imported successfully`,
            table_name: request.table,
            database: request.database,
            total_rows: row_count
        };
    } catch(error: any) {
        ctx.throw(500, error.message);
    }
}
