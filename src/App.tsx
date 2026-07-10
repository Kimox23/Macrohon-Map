import macrohonGeoJson from './data/Macrohon.json';
import macrohonTextGeoJson from './data/Macrohon_Text.json';
import MapView from './MapView';
import './App.css';
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

const App = () => {
  return (
    <>
      <title>Macrohon Cadastral</title>
      <MapView
        geojson={
          macrohonGeoJson as FeatureCollection<Geometry, GeoJsonProperties>
        }
        textGeojson={
          macrohonTextGeoJson as FeatureCollection<Geometry, GeoJsonProperties>
        }
      />
    </>
  );
};

export default App;
