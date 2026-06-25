
import { DuckDBResultReader, DuckDBInstanceCache, Json } from '@duckdb/node-api';
import { DuckColumnInfo, DuckTableInfo} from './types.ts';

export class DuckDBManager {

    private cache : DuckDBInstanceCache;

    constructor() {
        this.cache = new DuckDBInstanceCache();
    }

    async execute(database: string, query:string, args: any[] | undefined = undefined) : Promise<DuckDBResultReader>{
        const instance = await this.cache.getOrCreateInstance(database);
        const connection = await instance.connect();

        const reader = await connection.runAndReadAll(query, args);

        connection.disconnectSync();

        return reader;
    }

    async get_columns_from_query(database: string, query:string) : Promise<string[]> {
        const exec_query =  `SELECT * FROM (${query}) AS subquery LIMIT 0`;
        const reader = await this.execute(database, exec_query);
        return reader.columnNames();
    }

    async get_table_columns(database: string, table:string, nameonly: boolean = true) : Promise<Json[]|Json[][]> {
        const reader = await this.execute(database, `DESCRIBE ${table}`);


        if(nameonly) return reader.getColumnsJson()[0];

        return reader.getRowsJson();
    }

    async get_tables(database: string) : Promise<DuckTableInfo[]> {
        const reader = await this.execute(database, "SHOW TABLES");
        const tables = reader.getRowsJson();

        const info : DuckTableInfo[] = [];

        for(const table of tables) {
            const table_name: string = table[0] as string;
            const columns = await this.get_table_columns(database, table_name, false) as Json[][];

            const column_info: DuckColumnInfo[] = [];

            for (const col of columns) {
                column_info.push({name : col[0] as string, type: col[1] as string});
            }

            info.push({
                name: table_name,
                columns: column_info,
            });
        }

        return info;
    }

    async table_exists(database: string, table: string): Promise<boolean> {
        const tables_result = await this.execute(database, "SHOW TABLES");
        const table_exists = tables_result.getRowsJson().some((row: Json[]) => row[0] === table);
        return table_exists;
    }

    async count_rows(database: string, table: string): Promise<number> {
        const count_query = `SELECT COUNT(*) FROM ${table}`;
        const row_count_result = await this.execute(database, count_query);
        const row_count = row_count_result.getRowsJson()[0][0] as number;

        return row_count;
    }
}
