# Datacenter mapping tool

Mapping tool to locate and map dataenters to their electricty point of delivery and visualize their electric consumption.
It uses a SQL exploration and visualization platform featuring interactive charts, maps, and query capabilities.

## Requirements

- Deno
- npm

## Setup

### Backend

Go into the server directory.
Generate an ssl cetificate for HTTPS into an SSL directory. Files name are expected to be : cert.pem, key.pem.

To install dependencies :

``` sh
deno install
```

Then run : 

``` sh
deno --allow-net --allow-read --allow-ffi --allow-write index.ts
```

By default, the server will listen on port 8000.

### Frontend

You can either run a server with vite or server the built files using the deno server.

Go into the frontend directory.

Install dependencies using : 

``` sh
npm i
```


To launch a server using vite :

``` sh
npm run dev
```

It will listen on port 3000 by default, and connect to the backend url ``https://127.0.0.1:8000``.
You can change the backend url in the file config.json.

If you want the deno server to directly serve the frontend, just build the project using npm :

``` sh
npm run build
```

It will generate a dist directory that will be served by Deno. 
You can just go the Deno host url, for instance : https://localhost:80000/

## How to use the tool

The web page is composed of the following components :
- **database selector** : you can select a database on the server. Database should be placed in the server/datasets directory and end with .db extension. We use duckdb to exploit databases.
- **Tables** : when a database is selected, it will show the tables with their columns. If you click on the name of a table or a colunm, it will copy it into the clipboard, so you can paste it into the SQL editor.
- **SQL Editor** : you can write SQL request to query the current database. You can save and reuse queries so you don't have to retype it.
- **Query results** : It will display the row results from the SQL query.
- **Chart**: Below the SQL Editor you can ask to display the result as a chart. Then the chart component will be displayed instead of the raw query results. You can configured how you want the chart to look like and which column to display from the query resutlts.
- **Map**: An OpenStreetMap/leaflet map component to show the location from SQL queries. When you perform a query that either have the following columns : Longitude AND Latitude, Adresse AND Nom commune, geo-point iris .. you can use the button "Add to map" and it will create a for the map and displays all the locations. In the map component, you have a distance calculator tool : this is to find matches between two layers under a specified distance (slider). You can then either inspect all matches and accept or reject them, or take all matches wihtout verification and add them to the database, in an existing table or a new table.
