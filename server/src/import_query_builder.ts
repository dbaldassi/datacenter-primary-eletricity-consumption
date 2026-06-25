
import { Result } from './result.ts';
import { Point, Match, MatchMetadata } from './types.ts';

type PartialImportQuery = {
    select: string,
    where: string
}

const builders : Map<string, (p: Point, pp:string) => Result<PartialImportQuery, Error>> = new Map();
builders.set("consommation_entreprise", build_enedis_import_query);
builders.set("nuage", build_nuage_import_query);
builders.set("rte_sites_indus", build_rte_query);

function build_enedis_import_query(point: Point, prefix: string): Result<PartialImportQuery, Error> {
    const communes = point.properties["Nom commune"];
    const naf = point.properties["code_secteur_naf2"];
    const adresse = point.properties["Adresse"];

    if(!adresse) return new Result<PartialImportQuery, Error>(null, new Error("Missing adresse for Enedis import query"));
    if(!communes) return new Result<PartialImportQuery, Error>(null, new Error("Missing commune for Enedis import query"));
    if(!naf) return new Result<PartialImportQuery, Error>(null, new Error("Missing code naf for Enedis import query"));

    const query = {
        select: `${prefix}.Adresse, ${prefix}."Nom commune", ${prefix}.code_secteur_naf2, ${prefix}."Consommation annuelle totale de l'adresse (MWh)" AS conso, ${point.latitude} AS "Enedis Latitude", ${point.longitude} AS "Enedis Longitude"`,
        where: `${prefix}.Adresse='${adresse}' AND ${prefix}."Nom commune"='${communes}' AND ${prefix}.code_secteur_naf2=${naf} AND ${prefix}."Année"=2024`
    };

    return new Result<PartialImportQuery, Error>(query, null);
}

function build_nuage_import_query(point: Point, prefix: string): Result<PartialImportQuery, Error> {
    const query = {
        select: `${prefix}.Latitude, ${prefix}.Longitude, ${prefix}.name, ${prefix}."data_center:power" AS power`,
        where: `${prefix}.Latitude='${point.latitude}' AND ${prefix}.Longitude='${point.longitude}'`
    };

    return new Result<PartialImportQuery, Error>(query, null);
}

function build_rte_query(point: Point, prefix: string): Result<PartialImportQuery, Error> {
    const geopoint = point.properties["Géo-point IRIS"];

    if(!geopoint) return new Result<PartialImportQuery, Error>(null, new Error("Missing geo point iris for RTE table"));

    const query = {
        select: `${prefix}."Code IRIS", ${prefix}."Géo-point IRIS",  ${prefix}."Consommation électricité (MWh) - RTE" AS conso`,
        where: `${prefix}."Année"=2023 AND ${prefix}."Consommation électricité (MWh) - RTE" IS NOT NULL AND ${prefix}."Géo-point IRIS"='${geopoint}'`
    }

    return new Result<PartialImportQuery, Error>(query, null);
}

function get_point_query(table:string, point: Point, prefix:string) : Result<PartialImportQuery, Error> {
    if(!builders.has(table.toLowerCase())) {
        return new Result<PartialImportQuery, Error>(null, new Error("Table for layer 1 does not exist"));
    }

    const builder = builders.get(table.toLocaleLowerCase()) as (p: Point, pp:string) => Result<PartialImportQuery, Error>;
    return builder(point, prefix);
}

export function build_query(match: Match, metadata: MatchMetadata): Result<string, Error> {
    let result = get_point_query(metadata.table1, match.point1, "a");
    if(result.isError()) return new Result<string, Error>(null, result.get_err());

    const query1 = result.unwrap();

    result = get_point_query(metadata.table2, match.point2, "b");
    if(result.isError()) return new Result<string, Error>(null, result.get_err());

    const query2 = result.unwrap();

    const query_matches = `SELECT DISTINCT ${match.distance.meters} AS Distance_m,${query1.select},${query2.select} FROM ${metadata.table1} a,${metadata.table2} b WHERE ${query1.where} AND ${query2.where}`;

    console.log(query_matches);

    return new Result<string, Error>(query_matches, null);
}
