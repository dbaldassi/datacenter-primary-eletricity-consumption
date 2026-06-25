
export type GeoDatasetInfo = {
    id: string,
    name: string,
    filename: string
};

export type GeoDatasets = GeoDatasetInfo[];

export type GeocodedAddress = {
    longitude: string,
    latitude: string,
    label: string
}

export type DuckColumnInfo = {
    name: string,
    type: string
}

export type DuckTableInfo = {
    name: string,
    columns: DuckColumnInfo[]
}

export type DuckDBQueryRequest =  {
    database: string,
    query: string
}

export type SavedQuery = {
    name: string;
    database: string;
    query: string;
}

export type RenameQuery = {
    new_name: string;
}

export type DuckDBColumnsRequest = {
    database: string;
    query?: string;
    table?: string;
};

export type Point = {
    latitude: string,
    longitude: string,
    properties: any
}

export type Match = {
    point1: Point,
    point2: Point,
    distance: {
        meters: number,
        kilometers: number
    }
};

export type MatchMetadata = {
    table1: string,
    table2: string
}

export type Payload = {
    metadata: MatchMetadata,
    matches: Match[]
}

export type ImportMatchesRequest = {
    database: string,
    payload: string,
    table: string
};
