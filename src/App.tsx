import macrohonGeoJson from './data/Macrohon.json';
import macrohonTextGeoJson from './data/Macrohon_Text.json';
import MapView from './MapView';

const App = () => {
  return (
    <MapView geojson={macrohonGeoJson} textGeojson={macrohonTextGeoJson} />
  );
};

export default App;
