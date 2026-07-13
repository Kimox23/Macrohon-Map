import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { lazy, Suspense, useEffect, useState } from 'react';
import './App.css';

const MapView = lazy(() => import('./MapView'));

const DATA_URLS = {
  geojson: `${import.meta.env.BASE_URL}data/Macrohon.json`,
  textGeojson: `${import.meta.env.BASE_URL}data/Macrohon_Text.json`,
};

const App = () => {
  const [geojson, setGeojson] = useState<FeatureCollection<
    Geometry,
    GeoJsonProperties
  > | null>(null);
  const [textGeojson, setTextGeojson] = useState<FeatureCollection<
    Geometry,
    GeoJsonProperties
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(DATA_URLS.geojson).then((r) => r.json()),
      fetch(DATA_URLS.textGeojson).then((r) => r.json()),
    ])
      .then(([g, t]) => {
        if (cancelled) return;
        setGeojson(g);
        setTextGeojson(t);
      })
      .catch((err) => console.error('Failed to load map data', err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!geojson || !textGeojson) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-[#f2efe9] text-sm text-gray-500">
        Loading map…
      </div>
    );
  }

  return (
    <>
      <title>Macrohon Cadastral</title>
      <Suspense
        fallback={
          <div className="flex h-[100dvh] w-screen items-center justify-center bg-[#f2efe9] text-sm text-gray-500">
            Loading map…
          </div>
        }
      >
        <MapView geojson={geojson} textGeojson={textGeojson} />
      </Suspense>
    </>
  );
};

export default App;
