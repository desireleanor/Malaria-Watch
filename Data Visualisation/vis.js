'use strict';

// Register every cleaned dataset here; browsers are not allowed to list local folders.
const DATASETS = [
  { id: 'admissions', label: 'Malaria Admissions (Reported)', file: 'Export_Malaria_Admissions_(Reported).csv', unit: 'cases' },
  { id: 'children-under-5', label: 'Malaria Cases (Children under 5)', file: 'Export_Malaria_Cases_(Children_&lt;5_Years).csv', unit: 'cases' },
  { id: 'confirmed-cases', label: 'Malaria Cases (Confirmed)', file: 'Export_Malaria_Cases_(Confirmed).csv', unit: 'cases' },
  { id: 'estimated-cases', label: 'Malaria Cases (Estimated)', file: 'Export_Malaria_Cases_(Estimated).csv', unit: 'cases' },
  { id: 'opd-percentage', label: 'Malaria Cases as Percentage of Total OPD', file: 'Export_Malaria_Cases_as_Percentage_of_Total_OPD.csv', unit: '%' },
  { id: 'estimated-deaths', label: 'Malaria Deaths (Estimated)', file: 'Export_Malaria_Deaths_(Estimated).csv', unit: 'deaths' },
  { id: 'reported-deaths', label: 'Malaria Deaths (Reported)', file: 'Export_Malaria_Deaths_(Reported).csv', unit: 'deaths' },
  { id: 'incidence-rate', label: 'Malaria Incidence Rate', file: 'Export_Malaria_Incidence_Rate_(Per_1,000_Population).xlsx', unit: 'cases per 1,000 people', format: 'excel' },
  { id: 'pregnancy-prevalence', label: 'Malaria in Pregnancy Prevalence', file: 'Export_Malaria_in_Pregnancy_Prevalence.csv', unit: '%' },
  { id: 'opd-attendances', label: 'Malaria OPD Attendances', file: 'Export_Malaria_OPD_Attendances copy.xlsm', unit: 'attendances', format: 'excel' },
  { id: 'test-positivity', label: 'Malaria Test Positivity Rate', file: 'Export_Malaria_Test_Positivity_Rate copy.xlsm', unit: '%', format: 'excel' }
];

// Approximate centers of the regions in the source dataset [latitude, longitude].
const REGION_CENTERS = {
  Acholi: [3.15, 32.65], Ankole: [-0.55, 30.55], Buganda: [0.35, 32.15],
  Bugisu: [1.05, 34.25], Bukedi: [0.55, 33.85], Bunyoro: [1.6, 31.25],
  Busoga: [0.45, 33.35], Kampala: [0.3476, 32.5825], Karamoja: [2.8, 34.7],
  Kigezi: [-1.1, 29.8], Lango: [2.2, 32.7], Teso: [1.4, 33.9],
  Tooro: [0.65, 30.3], 'West Nile': [2.8, 31.1]
};

const datasetSelect = document.getElementById('dataset-select');
const yearSelect = document.getElementById('year-select');
const regionCount = document.getElementById('region-count');
const nationalValue = document.getElementById('national-value');
const unitLabel = document.getElementById('unit-label');
const mapDetail = document.getElementById('map-detail');
const status = document.getElementById('status');
let observationsByYear = new Map();
let selectedDataset = DATASETS[0];
const map = L.map('map-canvas', { scrollWheelZoom: true }).setView([1.37, 32.29], 6);
const imagery = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
).addTo(map);
const placeLabels = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Labels &copy; Esri' }
).addTo(map);
const markerLayer = L.layerGroup().addTo(map);
const initialMapView = { center: [1.37, 32.29], zoom: 6 };

document.getElementById('reset-map').addEventListener('click', () => {
  map.setView(initialMapView.center, initialMapView.zoom);
});

function parseCsvRow(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  fields.push(value);
  return fields;
}

function normalizeHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseRows(rows) {
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((item) => ['period', 'year'].includes(item)) &&
      headers.some((item) => ['location', 'region', 'district'].includes(item)) &&
      headers.some((item) => ['value', 'count', 'rate', 'percentage', 'prevalence'].includes(item));
  });
  if (headerRowIndex < 0) {
    throw new Error('Could not find year, location, and value columns in this file.');
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const yearIndex = headers.findIndex((item) => ['period', 'year'].includes(item));
  const locationIndex = headers.findIndex((item) => ['location', 'region', 'district'].includes(item));
  const valueIndex = headers.findIndex((item) => ['value', 'count', 'rate', 'percentage', 'prevalence'].includes(item));
  const grouped = new Map();

  for (const row of rows.slice(headerRowIndex + 1)) {
    const year = String(row[yearIndex] ?? '').trim();
    const location = String(row[locationIndex] ?? '').trim();
    const value = Number(String(row[valueIndex] ?? '').replace(/,/g, ''));
    if (!year || !location || !Number.isFinite(value)) continue;
    if (!grouped.has(year)) grouped.set(year, new Map());
    const locations = grouped.get(year);
    if (!locations.has(location)) locations.set(location, []);
    locations.get(location).push(value);
  }

  return new Map([...grouped].map(([year, locations]) => [year, new Map(
    [...locations].map(([location, values]) => [location, {
      average: values.reduce((sum, item) => sum + item, 0) / values.length,
      count: values.length
    }])
  )]));
}

function parseCsv(text) {
  return parseRows(text.trim().split(/\r?\n/).map(parseCsvRow));
}

async function getDatasetRows(dataset, response) {
  if (dataset.format === 'excel') {
    if (!window.XLSX) throw new Error('Spreadsheet reader did not load. Check your internet connection and reload.');
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: '' });
  }
  return (await response.text()).trim().split(/\r?\n/).map(parseCsvRow);
}

function formatValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function selectMarker(location, year, record) {
  mapDetail.textContent = `${location} - ${year}: ${formatValue(record.average)} ${selectedDataset.unit} (average of ${record.count} ${record.count === 1 ? 'record' : 'records'}).`;
}

function renderYear(year) {
  const locations = observationsByYear.get(year);
  if (!locations) return;

  markerLayer.clearLayers();
  const national = locations.get('Uganda');
  nationalValue.textContent = national ? formatValue(national.average) : 'Not reported';
  unitLabel.textContent = selectedDataset.unit;
  const regions = [...locations].filter(([location]) => location !== 'Uganda' && REGION_CENTERS[location]);
  regionCount.textContent = String(regions.length);

  const values = regions.map(([, record]) => record.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  for (const [location, record] of regions) {
    const [latitude, longitude] = REGION_CENTERS[location];
    const relative = max === min ? 0.5 : (record.average - min) / (max - min);
    const color = relative < 1 / 3 ? '#16866f' : relative < 2 / 3 ? '#d39a1e' : '#c7463d';
    const circle = L.circleMarker([latitude, longitude], {
      radius: 7 + relative * 7,
      color: '#ffffff',
      weight: 2,
      fillColor: color,
      fillOpacity: 0.9
    });
    circle.bindTooltip(`${location}: ${formatValue(record.average)} ${selectedDataset.unit}`);
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = location;
    const detail = document.createElement('p');
    detail.textContent = `${year} average: ${formatValue(record.average)} ${selectedDataset.unit} (${record.count} ${record.count === 1 ? 'record' : 'records'})`;
    popup.append(title, detail);
    circle.bindPopup(popup);
    circle.on('click', () => selectMarker(location, year, record));
    circle.addTo(markerLayer);
  }
  mapDetail.textContent = regions.length
    ? `Showing regional averages for ${year}. Select a marker for details.`
    : `No regional values are available for ${year}; the Uganda National Total is shown above.`;
}

async function loadDataset(datasetId) {
  const dataset = DATASETS.find((item) => item.id === datasetId);
  if (!dataset) return;
  selectedDataset = dataset;
  datasetSelect.disabled = true;
  yearSelect.disabled = true;
  status.hidden = true;
  status.textContent = '';

  try {
    const url = `../Datasets%28CLEANED%29/${encodeURIComponent(dataset.file)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${dataset.file} (HTTP ${response.status}).`);
    observationsByYear = parseRows(await getDatasetRows(dataset, response));
    const years = [...observationsByYear.keys()].sort((first, second) => Number(first) - Number(second));
    if (!years.length) throw new Error('No valid year and value records were found.');

    yearSelect.replaceChildren(...years.map((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      return option;
    }));
    yearSelect.value = years[years.length - 1];
    yearSelect.disabled = false;
    renderYear(yearSelect.value);
  } catch (error) {
    status.textContent = `${error.message} Open Vis.html through a local web server so the browser can read the dataset.`;
    status.hidden = false;
    markerLayer.clearLayers();
    regionCount.textContent = '0';
    nationalValue.textContent = '-';
  } finally {
    datasetSelect.disabled = false;
  }
}

datasetSelect.replaceChildren(...DATASETS.map((dataset) => {
  const option = document.createElement('option');
  option.value = dataset.id;
  option.textContent = dataset.label;
  return option;
}));
datasetSelect.addEventListener('change', () => loadDataset(datasetSelect.value));
yearSelect.addEventListener('change', () => renderYear(yearSelect.value));
datasetSelect.disabled = false;
loadDataset(datasetSelect.value);
