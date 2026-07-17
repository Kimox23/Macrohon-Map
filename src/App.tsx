import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { lazy, Suspense, useEffect, useState } from 'react';
import { FiLoader } from 'react-icons/fi';
import './App.css';

const MapView = lazy(() => import('./MapView'));

const DATA_URLS = {
  geojson: `${import.meta.env.BASE_URL}data/Macrohon.json`,
  textGeojson: `${import.meta.env.BASE_URL}data/Macrohon_Text.json`,
};

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="flex h-[100dvh] w-screen flex-col items-center justify-center gap-5 bg-[#f2efe9]">
    <div className="relative flex items-center justify-center">
      <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-blue-500/20" />
      <img
        src={`${import.meta.env.BASE_URL}favicon.png`}
        alt="Macrohon Cadastral logo"
        className="relative h-20 w-20 rounded-2xl bg-white p-2 shadow-lg"
      />
    </div>
    <div className="flex flex-col items-center gap-2">
      <span className="text-lg font-semibold tracking-tight text-gray-800">
        Macrohon Cadastral
      </span>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <FiLoader className="animate-spin" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  </div>
);

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
    return <LoadingScreen message="Loading map data…" />;
  }

  return (
    <>
      <title>Macrohon Cadastral</title>
      <Suspense fallback={<LoadingScreen message="Preparing map…" />}>
        <MapView geojson={geojson} textGeojson={textGeojson} />
      </Suspense>
    </>
  );
};

export default App;
