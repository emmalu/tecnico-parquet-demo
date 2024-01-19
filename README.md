# Overview
##### This repo leverages the power of Geoparquet datasets (saved in GeoArrow format) & DeckGL to render 3d building footprints, fast & dynamically.


## Why geoparquet?
Geoparquet files are structured to save data on a column by column basis. When saving as GeoArrow format, we convert our data into Binary, and remove the need for any part of the reading or rendering process to have to translate back and forth. This makes packaging and transmitting data as efficient as it could be - from a computer's perspective.

## Once the data is in binary, how can I use it?
In this demo, the goal is to use DevSeed's new libraries (WIP) to help us work with the geospatial data of interest (building footprints, in this case) in a fast & efficient manner, rendering through DeckGL onto a map view of choice (i.e. Mapbox).
- @geoarrow/deck.gl-layers
- apache-parquet
- parquet-wasm
