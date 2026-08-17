# Macrohon Cadastral

An interactive web map application for viewing the Macrohon cadastral dataset. It visualizes GeoJSON parcel boundaries, barangay boundary overlays, text labels, and a georeferenced raster basemap using MapLibre GL JS and React.

## Features

- Interactive map with multiple basemap styles (light, satellite, outdoor/topography)
- Toggleable overlay layers: raster imagery, barangay boundaries, parcels, and labels
- Layer visibility persisted across sessions via localStorage
- Persistent map style preference
- Searchable marker list with scroll-to-selection behavior
- Feature selection with highlight state
- Compass control

## Setup

Install the dependencies:

```bash
bun install
```

## Get started

Start the dev server, and the app will be available at [http://localhost:3000](http://localhost:3000).

```bash
bun run dev
```

Build the app for production:

```bash
bun run build
```

Preview the production build locally:

```bash
bun run preview
```

## Learn more

- [Rsbuild documentation](https://rsbuild.rs) - explore Rsbuild features and APIs.
- [Rsbuild GitHub repository](https://github.com/web-infra-dev/rsbuild) - your feedback and contributions are welcome!
