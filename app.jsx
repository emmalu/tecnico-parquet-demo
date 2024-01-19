import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StaticMap, MapContext, NavigationControl } from 'react-map-gl';
import DeckGL, { GeoJsonLayer } from 'deck.gl';
import { tableFromIPC } from 'apache-arrow/ipc/serialization';
import * as d3 from 'd3';
import * as arrow from 'apache-arrow';
import { SolidPolygonLayer } from '@deck.gl/layers';
import { GeoArrowSolidPolygonLayer } from '@geoarrow/deck.gl-layers';

// source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
const GEOJSON_DATA_URL =
  'https://devseed.s3.amazonaws.com/tecnico/tecnico_buildings_4326.geojson';
// const GEOJSON_DATA_URL =
//   'https://devseed.s3.amazonaws.com/tecnico/tecnico_lx_buildings_4326.geojson';

const PARQUET_DATA_URL =
// 'https://devseed.s3.amazonaws.com/tecnico/tecnico_buildings_4326%401.parquet';
'https://devseed.s3.amazonaws.com/tecnico/lx_buildings_augmented.parquet';

const COLUMNS_TO_RETURN = [
  'Name',
  'CdgPstl',
  'Period_con',
  'archetype',
  'tipologia',
  '_ineTEDIF',
  '%_heating_',
  '%_heatin_1',
  '%_heatin_2',
];

const INITIAL_VIEW_STATE = {
  latitude: 38.75,
  longitude: -9.12,
  zoom: 13,
  // latitude: 40.63403641639511,
  // longitude: -111.91530172951025,
  // zoom: 9,
  bearing: 0,
  pitch: 30,
};

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
const NAV_CONTROL_STYLE = {
  position: 'absolute',
  top: 10,
  left: 10,
};

function Root() {
  const [table, setTable] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [elevations, setElevations] = useState([]);
  const [buildingTypes, setBuildingTypes] = useState([]);

  const decodeBinaryValues = (data) => {
    const { values, valueOffsets } = data;

    const utf8Strings = [];
  
    for (let i = 0; i < valueOffsets.length - 1; i++) {
      const start = valueOffsets[i];
      const end = valueOffsets[i + 1];
  
      const utf8Bytes = values.slice(start, end);
      const decodedString = new TextDecoder('utf-8').decode(new Uint8Array(utf8Bytes));

      // check if string is not already in array
      // if (!utf8Strings.includes(decodedString)) {
      utf8Strings.push(decodedString);
      // }

    }
    return utf8Strings;
  };

  useEffect(() => {
    const fetchData = async () => {
      // Dynamically import the parquet-wasm library
      const parquet = await (async () => {
        const parquetModule = await import(
          'https://unpkg.com/parquet-wasm@0.4.0/esm/arrow2.js'
        );
        await parquetModule.default();
        return parquetModule;
      })();

      // Fetch Parquet file from the URL using the native fetch API
      const response = await fetch(PARQUET_DATA_URL);

      // Ensure request was successful (status code 200)
      if (!response.ok) {
        throw new Error(
          `Failed to fetch Parquet file. Status: ${response.status}`
        );
      }

      // Convert the response body to an ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      // console.log("ARRAY BUFFER", arrayBuffer)
      const parquetBytes = new Uint8Array(arrayBuffer);
      // console.log("PQ BYTES", parquetBytes)
      const decodedArrowBytes = await parquet.readParquet(parquetBytes);
      const arrowTable = tableFromIPC(decodedArrowBytes);

      // get fields
      const fields = arrowTable.schema.fields;
      console.log('FIELDS', fields);

      // get values for floors => to determine elevation extrusion
      const floors_ag = fields.find((f) => f.name === 'floors_ag');
      if(floors_ag) {
        // set elevations
        const elevationColumn = arrowTable.getChild('floors_ag');
        const elevationsArray = elevationColumn.data[0].values.map((v) => v * 9);
        setElevations(elevationsArray);
      }

      // get values for building types => to determine color
      const type = fields.find((f) => f.name === 'Period_con');
      if (type) {
        // set elevations
        const typeColumn = arrowTable.getChild('Period_con');
        const typesArray = typeColumn.data[0];
        let unique = true;
        const distinctStringTypes = decodeBinaryValues(typesArray);
        setBuildingTypes(distinctStringTypes);
      }

      // setData(data);
      setTable(arrowTable);
    };

    if (!table || table == null) {
      fetchData().catch(console.error);
    } else {
      console.log('TABLE IS LOADED', table);
    }
  });

  const onClick = (info) => {
    setPopupInfo(null);
    const objectData = info.object.toJSON();
    // console.log('INFO', objectData);
    if (info.object) {
      // eslint-disable-next-line
      // alert(`Building: ${objectData.Name} \nFloors: ${objectData.floors_ag}`);
      setPopupInfo(
        `Selected Building \n
        Name: ${objectData.Name} \n
        Floors: ${objectData.floors_ag} \n
        Typology: ${objectData.tipologia}\n`
      )
    }
  };

  const layers = [];

  table &&
    layers.push(
      new GeoArrowSolidPolygonLayer({
        id: 'layer-${Date.now()}',
        data: table,
        getPolygon: table.getChild('GEOMETRY'),
        // getFillColor: [0, 100, 60, 255],
        getFillColor: (f, _) => {
          let i = _['index'];

          // switch(buildingTypes[i]) {
          //   case "antes de 1919":
          //     return [102, 0, 153, 255];
          //   case "1919-1945":
          //     return [220, 0, 0, 255];
          //   case "1946-1960":
          //     return [21, 96, 189, 255];
          //   case "1961-1970":
          //     return [180, 48, 150, 255];
          //   case "1971-1980":
          //     return [204, 204, 0, 255];
          //   case "1981-1990":
          //     return [173, 216, 230, 255];
          //   case "1991-1995":
          //     return [152, 255, 152, 255];
          //   case "1996-2000":
          //     return [255, 223, 0, 255];
          //   case "2001-2005":
          //     return [0, 255, 255, 255];
          //   case "2006-2011":
          //     return [255, 165, 0, 255]; // Different color from "2001-2005"
          //   default:
          //     return [51, 51, 51, 255];
          // }

          let alpha = 0; // Default alpha value
          let color = [180, 48, 150];
          // Adjust alpha based on the decade
          switch(buildingTypes[i]) {
            case "antes de 1919":
              alpha = 255;
              break;
            case "1919-1945":
              alpha = 220;
              break;
            case "1946-1960":
              alpha = 200;
              break;
            case "1961-1970":
              alpha = 180;
              break;
            case "1971-1980":
              alpha = 160;
              break;
            case "1981-1990":
              alpha = 140;
              break;
            case "1991-1995":
              alpha = 120;
              break;
            case "1996-2000":
              alpha = 100;
              break;
            case "2001-2005":
              alpha = 80;
              break;
            case "2006-2011":
              alpha = 80;
              break;
            // Default case (e.g., "NA")
            default:
              alpha = 20;
          }
          // Return the updated RGBA color
          return [...color.slice(0, 3), alpha]; 
        },
        pickable: true,
        autoHighlight: true,
        earcutWorkerUrl: new URL(
          'https://cdn.jsdelivr.net/npm/@geoarrow/geoarrow-js@0.3.0-beta.1/dist/earcut-worker.min.js'
        ),
        onClick,
        extruded: true,
        getElevation: (f, _,) => {
          // console.log("ELEVATION EXTRUSION", _)
          let i = _["index"]
          return elevations[i]; // Multiplying by 10 for demonstration
        },
      })
    );

  return (
    table?.numRows > 0 ? 
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
      ContextProvider={MapContext.Provider}
    >
      <div id="info">
      <h2>Buildings Data</h2>
      <p>Total buildings: {table && table.numRows}</p>
      {  
        //render popup info into multiple lines
        popupInfo && popupInfo.split('\n').map((i,key) => {
          return <div key={key}>{i}</div>;
        })
      }
      </div>
      <StaticMap mapStyle={MAP_STYLE} />
      <NavigationControl style={NAV_CONTROL_STYLE} />
    </DeckGL>
  : <div id="loading"><h2>Loading...</h2></div>
  );
}

/* global document */
const container = document.body.appendChild(document.createElement('div'));
createRoot(container).render(<Root />);