const folder = '../Datasets%28CLEANED%29/';

const datasets = [
  { label: 'Malaria Admissions (Reported)', file: 'Export_Malaria_Admissions_(Reported).csv', unit: 'cases' },
  { label: 'Malaria Cases (Children under 5)', file: 'Export_Malaria_Cases_(Children_<5_Years).csv', unit: 'cases' },
  { label: 'Malaria Cases (Confirmed)', file: 'Export_Malaria_Cases_(Confirmed).csv', unit: 'cases' },
  { label: 'Malaria Cases (Estimated)', file: 'Export_Malaria_Cases_(Estimated).csv', unit: 'cases' },
  { label: 'Malaria Cases as Percentage of Total OPD', file: 'Export_Malaria_Cases_as_Percentage_of_Total_OPD.csv', unit: '%' },
  { label: 'Malaria Deaths (Estimated)', file: 'Export_Malaria_Deaths_(Estimated).csv', unit: 'deaths' },
  { label: 'Malaria Deaths (Reported)', file: 'Export_Malaria_Deaths_(Reported).csv', unit: 'deaths' },
  { label: 'Malaria Incidence Rate', file: 'Export_Malaria_Incidence_Rate_(Per_1,000_Population).xlsx', unit: 'cases per 1,000 people' },
  { label: 'Malaria in Pregnancy Prevalence', file: 'Export_Malaria_in_Pregnancy_Prevalence.csv', unit: '%' },
  { label: 'Malaria OPD Attendances', file: 'Export_Malaria_OPD_Attendances copy.xlsm', unit: 'attendances' },
  { label: 'Malaria Test Positivity Rate', file: 'Export_Malaria_Test_Positivity_Rate copy.xlsm', unit: '%' }
];

const regionCenters = {
  Acholi: [3.15, 32.65],
  Ankole: [-0.55, 30.55],
  Buganda: [0.35, 32.15],
  Bugisu: [1.05, 34.25],
  Bukedi: [0.55, 33.85],
  Bunyoro: [1.6, 31.25],
  Busoga: [0.45, 33.35],
  Kampala: [0.3476, 32.5825],
  Karamoja: [2.8, 34.7],
  Kigezi: [-1.1, 29.8],
  Lango: [2.2, 32.7],
  Teso: [1.4, 33.9],
  Tooro: [0.65, 30.3],
  'West Nile': [2.8, 31.1]
};

const datasetSelect = document.getElementById('dataset-select');
const yearSelect = document.getElementById('year-select');
const regionCount = document.getElementById('region-count');
const nationalValue = document.getElementById('national-value');
const unitLabel = document.getElementById('unit-label');
const errorBox = document.getElementById('status');

const map = L.map('map-canvas').setView([1.37, 32.29], 6);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
const markers = L.layerGroup().addTo(map);

let records = {};

function clean(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function average(place) {
  return place.total / place.count;
}

async function readRows(file) {
  const response = await fetch(folder + encodeURIComponent(file));
  if (!response.ok) throw new Error(`Could not load ${file}.`);
  const isCsv = file.endsWith('.csv');
  const data = isCsv ? await response.text() : await response.arrayBuffer();
  const workbook = XLSX.read(data, { type: isCsv ? 'string' : 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function toRecords(rows) {
  const headerIndex = rows.findIndex((row) => row.map(clean).includes('year') || row.map(clean).includes('period'));
  if (headerIndex < 0) throw new Error('Could not find the year, location and value columns.');

  const headers = rows[headerIndex].map(clean);
  const yearColumn = headers.findIndex((item) => ['period', 'year'].includes(item));
  const placeColumn = headers.findIndex((item) => ['location', 'region', 'district'].includes(item));
  const valueColumn = headers.findIndex((item) => ['value', 'count', 'rate', 'percentage', 'prevalence'].includes(item));

  const result = {};
  for (const row of rows.slice(headerIndex + 1)) {
    const year = String(row[yearColumn]).trim();
    const place = String(row[placeColumn]).trim();
    const value = parseFloat(String(row[valueColumn]).replace(/,/g, ''));
    if (!year || !place || isNaN(value)) continue;

    if (!result[year]) result[year] = {};
    if (!result[year][place]) result[year][place] = { total: 0, count: 0 };
    result[year][place].total += value;
    result[year][place].count += 1;
  }
  return result;
}

function showYear(year) {
  markers.clearLayers();
  const unit = datasets[datasetSelect.value].unit;
  const places = records[year];

  const national = places.Uganda;
  nationalValue.textContent = national ? round(average(national)) : 'Not reported';
  unitLabel.textContent = unit;

  const regions = Object.keys(places).filter((name) => regionCenters[name]);
  const values = regions.map((name) => average(places[name]));
  regionCount.textContent = regions.length;

  const lowest = Math.min(...values);
  const highest = Math.max(...values);

  regions.forEach((name, index) => {
    const share = highest === lowest ? 0.5 : (values[index] - lowest) / (highest - lowest);
    const colour = share < 1 / 3 ? 'green' : share < 2 / 3 ? 'gold' : 'red';
    L.circleMarker(regionCenters[name], { radius: 10, color: 'white', fillColor: colour, fillOpacity: 0.9 })
      .bindTooltip(`${name}: ${round(values[index])} ${unit}`)
      .addTo(markers);
  });
}

async function loadDataset() {
  const dataset = datasets[datasetSelect.value];
  errorBox.hidden = true;
  markers.clearLayers();

  try {
    records = toRecords(await readRows(dataset.file));
    const years = Object.keys(records).sort();
    yearSelect.innerHTML = '';
    years.forEach((year) => yearSelect.add(new Option(year, year)));
    yearSelect.value = years[years.length - 1];
    yearSelect.disabled = false;
    showYear(yearSelect.value);
  } catch (error) {
    errorBox.textContent = `${error.message} Open the page through a local server or GitHub Pages.`;
    errorBox.hidden = false;
  }
}

datasets.forEach((dataset, index) => datasetSelect.add(new Option(dataset.label, index)));
datasetSelect.addEventListener('change', loadDataset);
yearSelect.addEventListener('change', () => showYear(yearSelect.value));

loadDataset();
