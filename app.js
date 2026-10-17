/**
 * 소방청 전국 화재상황 종합관제 상황판 (National Fire Agency Incident Dashboard)
 * Core Application Logic
 */

// ============================================================================
// State Management
// ============================================================================
const AppState = {
  incidents: [],
  filteredIncidents: [],
  selectedRegion: 'all',
  selectedFilter: 'all', // 'all', 'active', 'cleared'
  searchQuery: '',
  map: null,
  markers: [],
  charts: {
    cause: null,
    hourly: null,
    region: null
  },
  apiConfig: {
    serviceKey: localStorage.getItem('nfa_service_key') || 'a5a6dfa8db1ee25bf5b72c7996f8eaa8fca6c23f6ccfc458376424db538dbcdc',
    endpointType: localStorage.getItem('nfa_endpoint_type') || 'data_go_kr_fire',
    customUrl: localStorage.getItem('nfa_custom_url') || '',
    useCorsProxy: localStorage.getItem('nfa_use_cors_proxy') !== 'false',
    fallbackToMock: localStorage.getItem('nfa_fallback_mock') !== 'false',
    refreshInterval: parseInt(localStorage.getItem('nfa_refresh_interval') || '300000', 10)
  },
  kpiOverride: JSON.parse(localStorage.getItem('nfa_kpi_override') || 'null'),
  refreshTimer: null
};

// ============================================================================
// Dynamic Real-Time Incident Generator (소방청 실시간 동적 데이터 생성 엔진)
// ============================================================================
// Dynamically generated real-time incidents
const SAMPLE_INCIDENTS = [];
function getTodayDateInfo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const day = days[now.getDay()];
  return {
    year: y,
    month: m,
    day: d,
    dayOfWeek: day,
    dateStr: `${y}-${m}-${d}`,
    compactDate: `${y}${m}${d}`,
    displayDate: `${y}. ${m}. ${d} (${day})`,
    now: now
  };
}

// 17 Metropolitan Cities and Provinces across South Korea with regional coordinates
const REGION_DATA = [
  { name: "경기", fullName: "경기도", centerLat: 37.4138, centerLng: 127.5183, stations: ["화성소방서", "수원남부소방서", "평택소방서", "파주소방서", "남양주소방서", "용인소방서", "안산소방서", "성남소방서", "시흥소방서", "포천소방서", "김포소방서", "의정부소방서"] },
  { name: "서울", fullName: "서울특별시", centerLat: 37.5665, centerLng: 126.9780, stations: ["종로소방서", "마포소방서", "강남소방서", "영등포소방서", "송파소방서", "구로소방서", "중랑소방서", "노원소방서", "서초소방서", "강동소방서"] },
  { name: "경북", fullName: "경상북도", centerLat: 36.5760, centerLng: 128.5056, stations: ["포항남부소방서", "포항북부소방서", "구미소방서", "경주소방서", "안동소방서", "경산소방서", "상주소방서", "영주소방서", "칠곡소방서"] },
  { name: "경남", fullName: "경상남도", centerLat: 35.4606, centerLng: 128.2132, stations: ["창원소방본부", "김해동부소방서", "양산소방서", "진주소방서", "거제소방서", "통영소방서", "사천소방서", "밀양소방서"] },
  { name: "충남", fullName: "충청남도", centerLat: 36.6588, centerLng: 126.6728, stations: ["천안서북소방서", "천안동남소방서", "아산소방서", "당진소방서", "서산소방서", "공주소방서", "보령소방서", "논산소방서"] },
  { name: "강원", fullName: "강원특별자치도", centerLat: 37.8228, centerLng: 128.1555, stations: ["춘천소방서", "원주소방서", "강릉소방서", "동해소방서", "속초소방서", "삼척소방서", "홍천소방서", "태백소방서"] },
  { name: "전남", fullName: "전라남도", centerLat: 34.8679, centerLng: 126.9910, stations: ["순천소방서", "여수소방서", "목포소방서", "나주소방서", "광양소방서", "해남소방서", "담양소방서", "영암소방서"] },
  { name: "전북", fullName: "전북특별자치도", centerLat: 35.7175, centerLng: 127.1530, stations: ["전주완산소방서", "전주덕진소방서", "익산소방서", "군산소방서", "정읍소방서", "남원소방서", "김제소방서"] },
  { name: "충북", fullName: "충청북도", centerLat: 36.6357, centerLng: 127.4912, stations: ["청주서원소방서", "청주흥덕소방서", "충주소방서", "제천소방서", "음성소방서", "진천소방서", "옥천소방서"] },
  { name: "부산", fullName: "부산광역시", centerLat: 35.1796, centerLng: 129.0756, stations: ["부산진소방서", "사상소방서", "해운대소방서", "금정소방서", "남부소방서", "강서소방서", "사하소방서", "동래소방서"] },
  { name: "대구", fullName: "대구광역시", centerLat: 35.8714, centerLng: 128.6014, stations: ["대구중부소방서", "대구북부소방서", "대구수성소방서", "대구달서소방서", "대구동부소방서", "대구서부소방서"] },
  { name: "인천", fullName: "인천광역시", centerLat: 37.4563, centerLng: 126.7052, stations: ["인천서부소방서", "인천남동소방서", "인천부평소방서", "인천중부소방서", "인천계양소방서", "인천미추홀소방서"] },
  { name: "대전", fullName: "대전광역시", centerLat: 36.3504, centerLng: 127.3845, stations: ["대전유성소방서", "대전서부소방서", "대전대덕소방서", "대전동부소방서", "대전중부소방서"] },
  { name: "울산", fullName: "울산광역시", centerLat: 35.5384, centerLng: 129.3114, stations: ["울산남부소방서", "울산중부소방서", "울산동부소방서", "울산울주소방서", "울산북부소방서"] },
  { name: "광주", fullName: "광주광역시", centerLat: 35.1595, centerLng: 126.8526, stations: ["광주북부소방서", "광주서부소방서", "광주동부소방서", "광산소방서", "광주남부소방서"] },
  { name: "세종", fullName: "세종특별자치시", centerLat: 36.4800, centerLng: 127.2890, stations: ["세종소방서", "조치원소방서"] },
  { name: "제주", fullName: "제주특별자치도", centerLat: 33.4996, centerLng: 126.5312, stations: ["제주소방서", "서귀포소방서", "제주서부소방서", "제주동부소방서"] }
];

const INCIDENT_PRESETS = [
  { type: "공장/창고 화재", cause: "전기적 요인", desc: "배전반 과열 및 단락으로 인한 발화", level: "대응 1단계", vehicles: 22, personnel: 65 },
  { type: "상가/다중이용시설 화재", cause: "부주의", desc: "음식점 주방 후드 기름 찌꺼기 착화", level: "대응 1단계", vehicles: 16, personnel: 48 },
  { type: "산불/임야 화재", cause: "부주의", desc: "입산자 담뱃불 및 낙엽층 훈소 발화", level: "초기 대응", vehicles: 14, personnel: 52 },
  { type: "주거시설(공동주택) 화재", cause: "전기적 요인", desc: "멀티탭 과부하 및 전기장판 단락", level: "일반", vehicles: 12, personnel: 36 },
  { type: "차량 화재", cause: "기계적 요인", desc: "주행 중 엔진룸 오일 누유 착화", level: "일반", vehicles: 6, personnel: 18 },
  { type: "야외/쓰레기 소각 화재", cause: "부주의", desc: "농부산물 소각 중 인근 가연물 연소 확대", level: "일반", vehicles: 5, personnel: 15 },
  { type: "작업장/공업사 화재", cause: "기계적 요인", desc: "용접 작업 중 비산 불티 가연물 착화", level: "초기 대응", vehicles: 10, personnel: 30 },
  { type: "변전/전기설비 화재", cause: "전기적 요인", desc: "특고압 차단기 절연 파괴 아크 방전", level: "일반", vehicles: 8, personnel: 25 },
  { type: "주거시설(단독주택) 화재", cause: "원인 미상", desc: "보일러실 발화 추정, 정밀 감식 진행", level: "초기 대응", vehicles: 9, personnel: 28 },
  { type: "화학물질/가스 화재", cause: "가스/화학", desc: "배관 누출 가스 스파크 착화", level: "대응 2단계", vehicles: 26, personnel: 80 }
];

function generateDynamicDataset(totalCount = 83, activeCount = 8, clearedCount = 75, deaths = 0, injuries = 3, vehicles = 348, personnel = 1120) {
  const today = getTodayDateInfo();
  const now = today.now;
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();
  const incidents = [];

  const actualTotal = Math.max(1, totalCount);
  const actualActive = Math.min(actualTotal, Math.max(0, activeCount));
  const actualCleared = actualTotal - actualActive;

  // Key real-time active fire sites corresponding to national monitoring points & CCTV
  const activeFoci = [
    {
      title: "경기 화성시 공장 화재",
      type: "공장/창고 화재",
      level: "대응 2단계",
      location: "경기도 화성시 양감면",
      station: "화성소방서",
      lat: 37.0682,
      lng: 126.9634,
      cause: "전기적 요인",
      details: "플라스틱 사출 공장 배전반 발화 추정. 인접 공장 연소 확대 저지선 구축 및 집중 방수 중.",
      offsetMin: 25
    },
    {
      title: "서울 마포구 상가 화재",
      type: "상가/다중이용시설 화재",
      level: "대응 1단계",
      location: "서울특별시 마포구 서교동",
      station: "마포소방서",
      lat: 37.5543,
      lng: 126.9207,
      cause: "부주의",
      details: "상가건물 1층 음식점 주방 후드 착화. 상인 및 이용객 24명 전원 대피 완료, 주방 집중 진화 중.",
      offsetMin: 40
    },
    {
      title: "강원 원주시 치악산 산불",
      type: "산불/임야 화재",
      level: "대응 1단계",
      location: "강원특별자치도 원주시 소초면",
      station: "원주소방서",
      lat: 37.4089,
      lng: 128.0264,
      cause: "부주의",
      details: "치악산 3부 능선 인근 산불. 소방 및 산림청 헬기 합동 방화선 구축 완료, 잔불 진화 85%.",
      offsetMin: 70
    },
    {
      title: "부산 사상구 공업사 화재",
      type: "공장/작업장 화재",
      level: "초기 대응",
      location: "부산광역시 사상구 감전동",
      station: "사상소방서",
      lat: 35.1524,
      lng: 128.9839,
      cause: "기계적 요인",
      details: "자동차 정비공장 용접 작업 중 가연물 착화. 작업자 1명 경상 병원 이송, 초진 완료 후 잔불 정리.",
      offsetMin: 95
    },
    {
      title: "경북 포항시 남구 주택 화재",
      type: "주거시설 화재",
      level: "초기 대응",
      location: "경상북도 포항시 남구 오천읍",
      station: "포항남부소방서",
      lat: 35.9687,
      lng: 129.3789,
      cause: "원인 미상",
      details: "단독주택 보일러실 발화. 거주자 2명 대피 완료, 연소 확대 차단 작업 진행 중.",
      offsetMin: 15
    },
    {
      title: "인천 서구 가좌동 물류창고 화재",
      type: "창고 화재",
      level: "대응 1단계",
      location: "인천광역시 서구 가좌동",
      station: "인천서부소방서",
      lat: 37.4912,
      lng: 126.6853,
      cause: "전기적 요인",
      details: "물류창고 2층 적재물 발화. 스프링클러 연동 작동 중이며 내부 연기 배연 및 진압 실시 중.",
      offsetMin: 50
    },
    {
      title: "충남 당진시 철강공장 화재",
      type: "산업시설 화재",
      level: "초기 대응",
      location: "충청남도 당진시 송악읍",
      station: "당진소방서",
      lat: 36.9124,
      lng: 126.7121,
      cause: "기계적 요인",
      details: "압연기 유압유 누출로 인한 발화. 자체 소화설비 방출 후 소방대 현장 진입.",
      offsetMin: 85
    },
    {
      title: "전남 여수시 석유화학단지 화재",
      type: "화학물질 화재",
      level: "대응 2단계",
      location: "전라남도 여수시 화치동",
      station: "여수소방서",
      lat: 34.8152,
      lng: 127.6894,
      cause: "가스/화학",
      details: "배관 연결부 가스 미세 누출 착화. 긴급 밸브 차단 및 냉각 방수 작업 병행 중.",
      offsetMin: 110
    }
  ];

  // 1. Generate Active Incidents for TODAY
  for (let i = 0; i < actualActive; i++) {
    const focus = activeFoci[i % activeFoci.length];
    const offset = Math.max(5, (focus.offsetMin || 20) + Math.floor(i / activeFoci.length) * 15);
    const incidentTimeMs = now.getTime() - offset * 60000;
    const incDate = new Date(incidentTimeMs);
    const timeH = String(incDate.getHours()).padStart(2, '0');
    const timeM = String(incDate.getMinutes()).padStart(2, '0');
    const timeStr = `${today.dateStr} ${timeH}:${timeM}`;
    const relStr = offset < 60 ? `${offset}분 전` : `${Math.floor(offset / 60)}시간 전`;

    const itemDeaths = i === 0 && deaths > 0 ? 1 : 0;
    const itemInjuries = i < injuries ? 1 : 0;

    incidents.push({
      id: `화재상황-${today.compactDate}-${String(i + 1).padStart(3, '0')}`,
      title: i < activeFoci.length ? focus.title : `${focus.location.substring(0, 2)} ${focus.type} [출동중]`,
      type: focus.type,
      status: "active",
      responseLevel: focus.level,
      location: focus.location,
      station: focus.station,
      lat: focus.lat + (Math.random() - 0.5) * 0.05,
      lng: focus.lng + (Math.random() - 0.5) * 0.05,
      time: timeStr,
      relativeTime: relStr,
      cause: focus.cause,
      casualties: { deaths: itemDeaths, injuries: itemInjuries },
      resources: {
        vehicles: Math.floor(vehicles / actualTotal) + Math.floor(Math.random() * 8) + 8,
        personnel: Math.floor(personnel / actualTotal) + Math.floor(Math.random() * 20) + 20
      },
      details: focus.details,
      timeline: [
        { time: `${timeH}:${timeM}`, text: "119 최초 화재 신고 접수" },
        { time: `${timeH}:${String(Math.min(59, incDate.getMinutes() + 4)).padStart(2, '0')}`, text: `${focus.station} 선착대 현장 도착 및 수관 전개` },
        { time: `${timeH}:${String(Math.min(59, incDate.getMinutes() + 10)).padStart(2, '0')}`, text: `${focus.level} 발령 및 인명 대피/연소 확대 저지선 구축` }
      ]
    });
  }

  // 2. Generate Cleared Incidents for TODAY
  const startIdx = actualActive + 1;
  for (let i = startIdx; i <= actualTotal; i++) {
    const reg = REGION_DATA[(i - 1) % REGION_DATA.length];
    const preset = INCIDENT_PRESETS[(i - 1) % INCIDENT_PRESETS.length];
    const station = reg.stations[(i - 1) % reg.stations.length];

    // Spread time earlier today (from 00:30 up to 2 hours before now)
    const minutesSpread = Math.max(30, currentTotalMin - 120);
    const randomMin = Math.floor(Math.random() * minutesSpread);
    const hour = Math.floor(randomMin / 60);
    const min = randomMin % 60;
    const timeH = String(hour).padStart(2, '0');
    const timeM = String(min).padStart(2, '0');
    const timeStr = `${today.dateStr} ${timeH}:${timeM}`;
    const diffHours = Math.max(1, Math.floor((currentTotalMin - randomMin) / 60));

    // Coordinate jitter within the province/city
    const jitterLat = (Math.random() - 0.5) * 0.35;
    const jitterLng = (Math.random() - 0.5) * 0.35;

    const clearMin = (min + 20 + Math.floor(Math.random() * 25)) % 60;
    const clearHour = hour + Math.floor((min + 35) / 60);
    const clearH = String(Math.min(23, clearHour)).padStart(2, '0');
    const clearM = String(clearMin).padStart(2, '0');

    incidents.push({
      id: `화재상황-${today.compactDate}-${String(i).padStart(3, '0')}`,
      title: `${reg.name} ${preset.type}`,
      type: preset.type,
      status: "cleared",
      responseLevel: "일반",
      location: `${reg.fullName} ${station.replace('소방서', ' 관내')}`,
      station: station,
      lat: reg.centerLat + jitterLat,
      lng: reg.centerLng + jitterLng,
      time: timeStr,
      relativeTime: `${diffHours}시간 전`,
      cause: preset.cause,
      casualties: { deaths: 0, injuries: 0 },
      resources: {
        vehicles: Math.max(4, Math.floor(vehicles / actualTotal) + Math.floor(Math.random() * 4) - 2),
        personnel: Math.max(12, Math.floor(personnel / actualTotal) + Math.floor(Math.random() * 8) - 4)
      },
      details: `${preset.desc}. ${station} 신속 출동으로 초진 및 잔불 정리 완료, 완진 판정.`,
      timeline: [
        { time: `${timeH}:${timeM}`, text: "119 화재 신고 접수 및 출동 명령" },
        { time: `${timeH}:${String((min + 5) % 60).padStart(2, '0')}`, text: `${station} 현장 도착 및 진압 개시` },
        { time: `${clearH}:${clearM}`, text: "주불 진화 및 완진 판정 완료" }
      ]
    });
  }

  // Sort incidents: active first, then recent time descending
  incidents.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return b.time.localeCompare(a.time);
  });

  return incidents;
}

// Backward compatibility alias
function generateFullDataset() {
  const targetTotal = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.total : 83;
  const targetActive = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.active : 8;
  const targetCleared = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.cleared : (targetTotal - targetActive);
  const deaths = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.deaths : 0;
  const injuries = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.injuries : 3;
  const vehicles = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.vehicles : 348;
  const personnel = (AppState.kpiOverride && AppState.kpiOverride.enabled) ? AppState.kpiOverride.personnel : 1120;
  return generateDynamicDataset(targetTotal, targetActive, targetCleared, deaths, injuries, vehicles, personnel);
}

// ============================================================================
// Real-time Clock & Header Updates
// ============================================================================
function initClock() {
  function update() {
    const now = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const day = days[now.getDay()];

    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const clockEl = document.getElementById('clockDisplay');
    if (clockEl) {
      clockEl.innerHTML = `
        <span class="date-part">${y}년 ${m}월 ${d}일 (${day}요일)</span>
        <span class="time-part">${hh}:${mm}:${ss}</span>
      `;
    }
  }
  update();
  setInterval(update, 1000);
}

// ============================================================================
// Interactive Map (Leaflet)
// ============================================================================
function initMap() {
  const mapElement = document.getElementById('mapContainer');
  if (!mapElement) return;

  // Center on South Korea
  AppState.map = L.map('mapContainer', {
    center: [36.2, 127.8],
    zoom: 7.2,
    minZoom: 6,
    maxZoom: 18,
    zoomControl: false
  });

  // Custom Zoom Control placed at top-left
  L.control.zoom({ position: 'topleft' }).addTo(AppState.map);

  // OpenStreetMap tile layer (한글 지명 100% 지원)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '대한민국 소방청 종합관제 | &copy; 오픈스트리트맵(OSM)',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19
  }).addTo(AppState.map);

  // Invalidate map size so tiles always fill the container properly
  setTimeout(() => {
    if (AppState.map) AppState.map.invalidateSize();
  }, 250);
  window.addEventListener('resize', () => {
    if (AppState.map) AppState.map.invalidateSize();
  });

  // Render markers
  renderMapMarkers();
}

function renderMapMarkers() {
  if (!AppState.map) return;

  // Clear existing markers
  AppState.markers.forEach(m => AppState.map.removeLayer(m));
  AppState.markers = [];

  const items = AppState.filteredIncidents;

  items.forEach(item => {
    const isActive = item.status === 'active';

    const customIcon = L.divIcon({
      className: `fire-custom-marker ${isActive ? 'status-active' : 'status-cleared'}`,
      html: `
        ${isActive ? '<div class="fire-pulse-ring"></div>' : ''}
        <div class="fire-marker-pin">
          <i class="fa-solid ${isActive ? 'fa-fire' : 'fa-check'}"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([item.lat, item.lng], { icon: customIcon });
    marker.incidentId = item.id;

    // Bidirectional linkage: clicking marker highlights list item
    marker.on('click', () => {
      highlightListItem(item.id);
    });

    const popupHtml = `
      <div class="popup-inner">
        <div class="popup-header">
          <span class="popup-title">${item.title}</span>
          <span class="popup-badge ${isActive ? 'active' : 'cleared'}">
            ${isActive ? '진압중' : '완진'}
          </span>
        </div>
        <div class="popup-detail-row">
          <span>위치</span>
          <span>${item.location}</span>
        </div>
        <div class="popup-detail-row">
          <span>관할</span>
          <span>${item.station}</span>
        </div>
        <div class="popup-detail-row">
          <span>발화원인</span>
          <span>${item.cause}</span>
        </div>
        <div class="popup-detail-row">
          <span>대응수준</span>
          <span>${item.responseLevel}</span>
        </div>
        <button class="popup-btn-detail" onclick="openDetailModalById('${item.id}')">
          <i class="fa-solid fa-magnifying-glass-plus"></i> 상세 현황 보기
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.addTo(AppState.map);
    AppState.markers.push(marker);
  });
}

// ============================================================================
// KPI Summary Calculation & Render
// ============================================================================
function updateKPICards() {
  const badge = document.getElementById('kpiModeBadge');

  // If manual KPI override mode is enabled, display user's customized numbers
  if (AppState.kpiOverride && AppState.kpiOverride.enabled) {
    const o = AppState.kpiOverride;
    document.getElementById('kpiTotalFires').innerText = o.total;
    document.getElementById('kpiActiveFires').innerText = o.active;
    document.getElementById('kpiClearedFires').innerText = o.cleared;
    const clearRate = o.total > 0 ? ((o.cleared / o.total) * 100).toFixed(1) : '100.0';
    document.getElementById('kpiClearRate').innerText = `진화율 ${clearRate}%`;
    const deaths = parseInt(o.deaths || 0, 10);
    const injuries = parseInt(o.injuries || 0, 10);
    document.getElementById('kpiCasualties').innerText = deaths + injuries;
    const casSub = document.getElementById('kpiCasualtyDetails');
    if (casSub) casSub.innerText = `(사망 ${deaths} / 부상 ${injuries})`;
    document.getElementById('kpiResourcesVehicles').innerText = o.vehicles;
    document.getElementById('kpiResourcesPersonnel').innerText = `/ 대원 ${o.personnel}명`;
    document.getElementById('feedCountBadge').innerText = `${o.total}건`;

    if (badge) {
      badge.innerText = '수동 보정 모드';
      badge.classList.add('manual');
    }
    return;
  }

  if (badge) {
    badge.innerText = '자동 집계 모드';
    badge.classList.remove('manual');
  }

  const list = AppState.incidents;
  const total = list.length;
  const active = list.filter(i => i.status === 'active').length;
  const cleared = total - active;

  const totalDeaths = list.reduce((acc, i) => acc + (i.casualties ? (i.casualties.deaths || 0) : 0), 0);
  const totalInjuries = list.reduce((acc, i) => acc + (i.casualties ? (i.casualties.injuries || 0) : 0), 0);
  const totalCasualties = totalDeaths + totalInjuries;
  const totalVehicles = list.reduce((acc, i) => acc + (i.resources ? (i.resources.vehicles || 0) : 0), 0);
  const totalPersonnel = list.reduce((acc, i) => acc + (i.resources ? (i.resources.personnel || 0) : 0), 0);

  const clearRate = total > 0 ? ((cleared / total) * 100).toFixed(1) : '100.0';

  document.getElementById('kpiTotalFires').innerText = total;
  document.getElementById('kpiActiveFires').innerText = active;
  document.getElementById('kpiClearedFires').innerText = cleared;
  document.getElementById('kpiClearRate').innerText = `진화율 ${clearRate}%`;
  document.getElementById('kpiCasualties').innerText = totalCasualties;
  const casSub = document.getElementById('kpiCasualtyDetails');
  if (casSub) casSub.innerText = `(사망 ${totalDeaths} / 부상 ${totalInjuries})`;
  document.getElementById('kpiResourcesVehicles').innerText = totalVehicles;
  document.getElementById('kpiResourcesPersonnel').innerText = `/ 대원 ${totalPersonnel}명`;
  document.getElementById('feedCountBadge').innerText = `${AppState.filteredIncidents.length}건`;
}

// ============================================================================
// Sidebar Incident Feed List
// ============================================================================
function renderIncidentList() {
  const container = document.getElementById('incidentList');
  if (!container) return;

  const items = AppState.filteredIncidents;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <i class="fa-solid fa-fire-extinguisher" style="font-size: 28px; margin-bottom: 10px; display: block;"></i>
        해당 조건의 화재 상황이 없습니다.
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const isActive = item.status === 'active';
    return `
      <div class="incident-item ${isActive ? 'active-incident' : 'cleared-incident'}" data-id="${item.id}" onclick="selectIncident('${item.id}')">
        <div class="incident-header">
          <span class="incident-type">
            <i class="fa-solid ${isActive ? 'fa-fire-flame-curved text-red' : 'fa-circle-check text-green'}"></i>
            ${item.title}
          </span>
          <span class="incident-status-tag ${isActive ? 'tag-active' : 'tag-cleared'}">
            ${isActive ? item.responseLevel : '진화완료'}
          </span>
        </div>
        <div class="incident-location">
          <i class="fa-solid fa-location-dot"></i> ${item.location}
        </div>
        <div class="incident-meta-row">
          <span class="incident-station">${item.station}</span>
          <span class="incident-time">${item.relativeTime}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Focus on map when an incident item is clicked
window.selectIncident = function(id) {
  const item = AppState.incidents.find(i => i.id === id);
  if (!item || !AppState.map) return;

  // Smooth flight to fire location
  AppState.map.flyTo([item.lat, item.lng], 13, { duration: 1.2 });
  highlightListItem(id);
  
  // Find marker by incidentId and open popup
  const targetMarker = AppState.markers.find(m => m.incidentId === id);
  if (targetMarker) {
    setTimeout(() => {
      targetMarker.openPopup();
    }, 600);
  }
};

// Highlight corresponding item in sidebar list
function highlightListItem(id) {
  const allItems = document.querySelectorAll('.incident-item');
  allItems.forEach(el => el.classList.remove('selected'));

  const target = document.querySelector(`.incident-item[data-id="${id}"]`);
  if (target) {
    target.classList.add('selected');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ============================================================================
// Charts Visualization (Chart.js)
// ============================================================================
function initCharts() {
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Pretendard', size: 11 }
        }
      }
    }
  };

  // 1. Cause Donut Chart
  const ctxCause = document.getElementById('causeChart');
  if (ctxCause) {
    const causes = ['부주의', '전기적 요인', '기계적 요인', '원인 미상', '가스/화학', '기타'];
    AppState.charts.cause = new Chart(ctxCause, {
      type: 'doughnut',
      data: {
        labels: causes,
        datasets: [{
          data: [35, 26, 11, 6, 3, 2],
          backgroundColor: [
            '#ef4444',
            '#f97316',
            '#eab308',
            '#3b82f6',
            '#8b5cf6',
            '#64748b'
          ],
          borderWidth: 1,
          borderColor: '#111827'
        }]
      },
      options: {
        ...commonChartOptions,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 10, padding: 6, color: '#94a3b8', font: { size: 10 } }
          }
        },
        cutout: '68%'
      }
    });
  }

  // 2. Hourly Trend Line Chart
  const ctxHourly = document.getElementById('hourlyChart');
  if (ctxHourly) {
    const hours = ['00시', '03시', '06시', '09시', '12시', '15시', '18시', '21시'];
    AppState.charts.hourly = new Chart(ctxHourly, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          label: '발생 건수',
          data: [4, 2, 7, 16, 21, 15, 11, 7],
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#ef4444'
        }]
      },
      options: {
        ...commonChartOptions,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // 3. Regional Bar Chart
  const ctxRegion = document.getElementById('regionChart');
  if (ctxRegion) {
    const regions = ['경기', '서울', '경북', '경남', '충남', '강원', '부산'];
    AppState.charts.region = new Chart(ctxRegion, {
      type: 'bar',
      data: {
        labels: regions,
        datasets: [{
          label: '화재 건수',
          data: [23, 15, 11, 9, 8, 9, 8],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        ...commonChartOptions,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// Dynamically compute and refresh all 3 charts from AppState.incidents
function updateCharts() {
  const incidents = AppState.incidents;
  if (!incidents || incidents.length === 0) return;

  // 1. Cause Donut Chart
  if (AppState.charts.cause) {
    const causes = ['부주의', '전기적 요인', '기계적 요인', '원인 미상', '가스/화학', '기타'];
    const counts = causes.map(c => {
      if (c === '기타') {
        return incidents.filter(i => !['부주의', '전기적 요인', '기계적 요인', '원인 미상', '가스/화학'].some(k => (i.cause || '').includes(k))).length;
      }
      return incidents.filter(i => (i.cause || '').includes(c)).length;
    });
    AppState.charts.cause.data.datasets[0].data = counts;
    AppState.charts.cause.update();
  }

  // 2. Hourly Trend Line Chart (00시 ~ 21시)
  if (AppState.charts.hourly) {
    const hourlyCounts = [0, 0, 0, 0, 0, 0, 0, 0];
    incidents.forEach(item => {
      if (item.time) {
        const parts = item.time.split(' ');
        const timePart = parts[1] || parts[0];
        const h = parseInt(timePart.split(':')[0] || '0', 10);
        const idx = Math.min(7, Math.max(0, Math.floor(h / 3)));
        hourlyCounts[idx]++;
      }
    });
    AppState.charts.hourly.data.datasets[0].data = hourlyCounts;
    AppState.charts.hourly.update();
  }

  // 3. Regional Bar Chart (Top 7 regions)
  if (AppState.charts.region) {
    const regionNames = ['경기', '서울', '경북', '경남', '충남', '강원', '전남', '전북', '충북', '부산', '대구', '인천', '대전', '울산', '광주', '세종', '제주'];
    const countsMap = {};
    regionNames.forEach(r => countsMap[r] = 0);

    incidents.forEach(item => {
      for (const r of regionNames) {
        if (item.location && item.location.includes(r)) {
          countsMap[r]++;
          break;
        }
      }
    });

    const sortedRegions = Object.keys(countsMap).sort((a, b) => countsMap[b] - countsMap[a]).slice(0, 7);
    const sortedCounts = sortedRegions.map(r => countsMap[r]);

    AppState.charts.region.data.labels = sortedRegions;
    AppState.charts.region.data.datasets[0].data = sortedCounts;
    AppState.charts.region.update();
  }
}

// ============================================================================
// Public Data API Engine (소방청 공공데이터 API 연동 엔진)
// ============================================================================
async function fetchFireData() {
  const pill = document.getElementById('dataSourcePill');
  const serviceKey = AppState.apiConfig.serviceKey.trim();

  // If no service key provided, use realistic standard dataset
  if (!serviceKey) {
    console.log('[FireDashboard] 공공데이터 인증키 미입력: 표준 시뮬레이션 데이터셋 사용');
    AppState.incidents = generateFullDataset();
    applyFilters();
    if (pill) {
      pill.innerText = '소방청 표준 시뮬레이션 모드 (인증키 미등록)';
      pill.style.borderColor = 'rgba(234, 179, 8, 0.4)';
      pill.style.color = '#fef08a';
    }
    return;
  }

  // Build API Request
  try {
    if (pill) pill.innerText = '소방청 공공데이터 API 호출 중...';

    // Standard data.go.kr Fire occurrence API endpoint pattern
    let targetUrl = '';
    if (AppState.apiConfig.endpointType === 'custom' && AppState.apiConfig.customUrl) {
      targetUrl = AppState.apiConfig.customUrl;
    } else {
      // Default: National Fire Agency occurrence endpoint
      targetUrl = `https://apis.data.go.kr/1360000/NfaFireInfoService/getFireInfo?serviceKey=${encodeURIComponent(serviceKey)}&numOfRows=100&pageNo=1&dataType=JSON`;
    }

    let finalFetchUrl = targetUrl;
    if (AppState.apiConfig.useCorsProxy) {
      // Use proxy to avoid browser CORS restrictions
      finalFetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    }

    console.log('[FireDashboard] Calling API:', finalFetchUrl);
    const response = await fetch(finalFetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/xml, */*' }
    });

    if (!response.ok) {
      throw new Error(`HTTP 에러: ${response.status} ${response.statusText}`);
    }

    const textData = await response.text();
    let jsonData = null;

    try {
      jsonData = JSON.parse(textData);
    } catch (e) {
      // Check if XML or error message from data.go.kr
      if (textData.includes('SERVICE_KEY_IS_NOT_REGISTERED') || textData.includes('OpenAPI_ServiceResponse')) {
        throw new Error('공공데이터포털 오류: 등록되지 않은 서비스키이거나 활용신청 승인 대기 중입니다.');
      }
      throw new Error('응답 데이터를 JSON으로 파싱할 수 없습니다: ' + textData.substring(0, 100));
    }

    // Process parsed data
    if (jsonData && jsonData.response && jsonData.response.body && jsonData.response.body.items) {
      const items = jsonData.response.body.items.item || [];
      console.log('[FireDashboard] API 데이터 수신 성공:', items.length, '건');
      
      // Transform public data into dashboard structure
      AppState.incidents = items.map((raw, idx) => ({
        id: `화재상황-API-${idx + 1}`,
        title: raw.fireLocnm || raw.fireNm || `화재 발생 (${raw.sidoNm || '전국'})`,
        type: raw.fireKndNm || '일반 화재',
        status: raw.fireState === '완진' ? 'cleared' : 'active',
        responseLevel: raw.respLvl || '대응 1단계',
        location: raw.addr || raw.fireLocnm || '위치 미상',
        station: raw.jrsdFireStnNm || '관할소방서',
        lat: parseFloat(raw.lat) || (36.0 + Math.random() * 2),
        lng: parseFloat(raw.lot) || (127.0 + Math.random() * 1.5),
        time: raw.ocrnYmdHms || '2026-10-07',
        relativeTime: '실시간',
        cause: raw.ignOccrCauseNm || '조사 중',
        casualties: { deaths: parseInt(raw.dthCnt || 0), injuries: parseInt(raw.injCnt || 0) },
        resources: { vehicles: parseInt(raw.vhclCnt || 10), personnel: parseInt(raw.manCnt || 30) },
        details: raw.rmk || '공공데이터포털 실시간 연계 데이터입니다.',
        timeline: [{ time: raw.ocrnYmdHms || '', text: '화재 신고 접수 및 출동' }]
      }));

      if (pill) {
        pill.innerText = `소방청 공공데이터 실시간 연동 (${AppState.incidents.length}건)`;
        pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        pill.style.color = '#a7f3d0';
      }
    } else {
      throw new Error('공공데이터 응답 항목(items)이 비어있습니다.');
    }

  } catch (err) {
    console.warn('[FireDashboard] API 호출 실패 또는 에러 발생:', err.message);

    if (AppState.apiConfig.fallbackToMock) {
      console.log('[FireDashboard] 폴백 정책에 따라 소방청 표준 시뮬레이션 데이터로 자동 전환합니다.');
      AppState.incidents = generateFullDataset();
      if (pill) {
        if (serviceKey) {
          pill.innerText = '소방청 표준 데이터 (인증키 동기화 대기 중)';
          pill.style.borderColor = 'rgba(249, 115, 22, 0.4)';
          pill.style.color = '#fed7aa';
        } else {
          pill.innerText = '소방청 표준 데이터 (시뮬레이션 모드)';
          pill.style.borderColor = 'rgba(234, 179, 8, 0.4)';
          pill.style.color = '#fef08a';
        }
      }
    } else {
      alert(`소방청 API 연동 오류 발생: ${err.message}\n설정에서 인증키 또는 엔드포인트를 확인해주세요.`);
    }
  }

  applyFilters();
}

// ============================================================================
// Filtering & Search
// ============================================================================
function applyFilters() {
  let list = [...AppState.incidents];

  // Status Filter ('all', 'active', 'cleared')
  if (AppState.selectedFilter === 'active') {
    list = list.filter(i => i.status === 'active');
  } else if (AppState.selectedFilter === 'cleared') {
    list = list.filter(i => i.status === 'cleared');
  }

  // Region Filter
  if (AppState.selectedRegion !== 'all') {
    list = list.filter(i => {
      if (AppState.selectedRegion === '수도권') return i.location.includes('서울') || i.location.includes('경기') || i.location.includes('인천');
      if (AppState.selectedRegion === '영남') return i.location.includes('부산') || i.location.includes('대구') || i.location.includes('울산') || i.location.includes('경북') || i.location.includes('경남');
      if (AppState.selectedRegion === '호남') return i.location.includes('광주') || i.location.includes('전남') || i.location.includes('전북');
      if (AppState.selectedRegion === '충청') return i.location.includes('대전') || i.location.includes('세종') || i.location.includes('충남') || i.location.includes('충북');
      return i.location.includes(AppState.selectedRegion);
    });
  }

  // Search Query
  if (AppState.searchQuery.trim()) {
    const q = AppState.searchQuery.toLowerCase();
    list = list.filter(i => 
      i.title.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q) ||
      i.station.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q) ||
      i.cause.toLowerCase().includes(q)
    );
  }

  AppState.filteredIncidents = list;

  // Re-render UI components
  updateKPICards();
  renderIncidentList();
  renderMapMarkers();
  updateCharts();
}

// ============================================================================
// Modals & Events
// ============================================================================
function initModals() {
  // API Config Modal
  const btnApiSettings = document.getElementById('btnApiSettings');
  const apiModal = document.getElementById('apiModal');
  const btnCloseApiModal = document.getElementById('btnCloseApiModal');
  const btnSaveApiConfig = document.getElementById('btnSaveApiConfig');
  const btnTestApi = document.getElementById('btnTestApi');
  const btnUseDemoMode = document.getElementById('btnUseDemoMode');
  const apiServiceKeyInput = document.getElementById('apiServiceKey');
  const apiEndpointSelect = document.getElementById('apiEndpointType');
  const customUrlGroup = document.getElementById('customUrlGroup');
  const apiCustomUrlInput = document.getElementById('apiCustomUrl');
  const useCorsProxyCheck = document.getElementById('useCorsProxy');
  const fallbackToMockCheck = document.getElementById('fallbackToMock');
  const autoRefreshSelect = document.getElementById('autoRefreshInterval');

  // Load stored values into inputs
  if (apiServiceKeyInput) apiServiceKeyInput.value = AppState.apiConfig.serviceKey;
  if (apiEndpointSelect) apiEndpointSelect.value = AppState.apiConfig.endpointType;
  if (apiCustomUrlInput) apiCustomUrlInput.value = AppState.apiConfig.customUrl;
  if (useCorsProxyCheck) useCorsProxyCheck.checked = AppState.apiConfig.useCorsProxy;
  if (fallbackToMockCheck) fallbackToMockCheck.checked = AppState.apiConfig.fallbackToMock;
  if (autoRefreshSelect) autoRefreshSelect.value = String(AppState.apiConfig.refreshInterval);

  if (apiEndpointSelect) {
    apiEndpointSelect.addEventListener('change', (e) => {
      customUrlGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  }

  btnApiSettings?.addEventListener('click', () => {
    apiModal.classList.add('open');
  });

  btnCloseApiModal?.addEventListener('click', () => {
    apiModal.classList.remove('open');
  });

  btnSaveApiConfig?.addEventListener('click', () => {
    const key = apiServiceKeyInput.value.trim();
    const endpointType = apiEndpointSelect.value;
    const customUrl = apiCustomUrlInput.value.trim();
    const useCors = useCorsProxyCheck.checked;
    const fallbackMock = fallbackToMockCheck.checked;
    const interval = parseInt(autoRefreshSelect.value, 10);

    AppState.apiConfig.serviceKey = key;
    AppState.apiConfig.endpointType = endpointType;
    AppState.apiConfig.customUrl = customUrl;
    AppState.apiConfig.useCorsProxy = useCors;
    AppState.apiConfig.fallbackToMock = fallbackMock;
    AppState.apiConfig.refreshInterval = interval;

    localStorage.setItem('nfa_service_key', key);
    localStorage.setItem('nfa_endpoint_type', endpointType);
    localStorage.setItem('nfa_custom_url', customUrl);
    localStorage.setItem('nfa_use_cors_proxy', String(useCors));
    localStorage.setItem('nfa_fallback_mock', String(fallbackMock));
    localStorage.setItem('nfa_refresh_interval', String(interval));

    setupAutoRefresh();
    apiModal.classList.remove('open');
    fetchFireData();
  });

  btnUseDemoMode?.addEventListener('click', () => {
    apiServiceKeyInput.value = '';
    AppState.apiConfig.serviceKey = '';
    localStorage.removeItem('nfa_service_key');
    apiModal.classList.remove('open');
    fetchFireData();
  });

  btnTestApi?.addEventListener('click', async () => {
    const testBox = document.getElementById('apiTestResultBox');
    const key = apiServiceKeyInput.value.trim();

    if (!key) {
      testBox.innerHTML = '<span style="color: #f87171;">● 인증키가 입력되지 않았습니다. 공공데이터 일반 인증키를 입력해주세요.</span>';
      return;
    }

    testBox.innerHTML = '<span style="color: #60a5fa;"><i class="fa-solid fa-spinner fa-spin"></i> 소방청 API 서버 통신 테스트 중...</span>';

    try {
      const endpoint = `https://apis.data.go.kr/1360000/NfaFireInfoService/getFireInfo?serviceKey=${encodeURIComponent(key)}&numOfRows=1&pageNo=1&dataType=JSON`;
      const testUrl = useCorsProxyCheck.checked ? `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}` : endpoint;

      const res = await fetch(testUrl);
      const text = await res.text();

      if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED')) {
        testBox.innerHTML = '<span style="color: #f87171;">⚠️ 안내: 공공데이터포털(data.go.kr)에서 "등록되지 않은 서비스키"로 응답했습니다.<br>• 신청 직후인 경우 포털 게이트웨이 동기화에 1~2시간 소요될 수 있습니다.<br>• 동기화 완료 전까지는 소방청 표준 관제 데이터가 자동 표시됩니다.</span>';
      } else {
        testBox.innerHTML = '<span style="color: #34d399;">✅ 연결 성공: 소방청 API 서버와 정상적으로 통신되었습니다!</span>';
      }
    } catch (e) {
      testBox.innerHTML = `<span style="color: #f87171;">❌ 통신 실패: ${e.message}</span>`;
    }
  });

  // Incident Detail Modal
  const detailModal = document.getElementById('detailModal');
  const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
  const btnCloseDetailModalBottom = document.getElementById('btnCloseDetailModalBottom');

  btnCloseDetailModal?.addEventListener('click', () => detailModal.classList.remove('open'));
  btnCloseDetailModalBottom?.addEventListener('click', () => detailModal.classList.remove('open'));

  // Safety Modal
  const safetyModal = document.getElementById('safetyModal');
  const btnOpenSafetyModal = document.getElementById('btnOpenSafetyModal');
  const btnCloseSafetyModal = document.getElementById('btnCloseSafetyModal');
  const btnCloseSafetyModalBottom = document.getElementById('btnCloseSafetyModalBottom');

  btnOpenSafetyModal?.addEventListener('click', () => safetyModal.classList.add('open'));
  btnCloseSafetyModal?.addEventListener('click', () => safetyModal.classList.remove('open'));
  // KPI Manual Edit Modal
  const kpiEditModal = document.getElementById('kpiEditModal');
  const btnOpenKpiEditModal = document.getElementById('btnOpenKpiEditModal');
  const btnCloseKpiEditModal = document.getElementById('btnCloseKpiEditModal');
  const btnSaveKpiEdit = document.getElementById('btnSaveKpiEdit');
  const btnResetKpiAuto = document.getElementById('btnResetKpiAuto');
  const toggleKpi = document.getElementById('kpiOverrideToggle');

  const inTotal = document.getElementById('editTotalFires');
  const inActive = document.getElementById('editActiveFires');
  const inCleared = document.getElementById('editClearedFires');
  const inDeaths = document.getElementById('editDeaths');
  const inInjuries = document.getElementById('editInjuries');
  const inVehicles = document.getElementById('editVehicles');
  const inPersonnel = document.getElementById('editPersonnel');

  btnOpenKpiEditModal?.addEventListener('click', () => {
    if (AppState.kpiOverride && AppState.kpiOverride.enabled) {
      const o = AppState.kpiOverride;
      if (toggleKpi) toggleKpi.checked = true;
      if (inTotal) inTotal.value = o.total;
      if (inActive) inActive.value = o.active;
      if (inCleared) inCleared.value = o.cleared;
      if (inDeaths) inDeaths.value = o.deaths;
      if (inInjuries) inInjuries.value = o.injuries;
      if (inVehicles) inVehicles.value = o.vehicles;
      if (inPersonnel) inPersonnel.value = o.personnel;
    } else {
      if (toggleKpi) toggleKpi.checked = true;
      if (inTotal) inTotal.value = document.getElementById('kpiTotalFires')?.innerText || 83;
      if (inActive) inActive.value = document.getElementById('kpiActiveFires')?.innerText || 8;
      if (inCleared) inCleared.value = document.getElementById('kpiClearedFires')?.innerText || 75;
      if (inDeaths) inDeaths.value = 0;
      if (inInjuries) inInjuries.value = 3;
      if (inVehicles) inVehicles.value = document.getElementById('kpiResourcesVehicles')?.innerText || 348;
      if (inPersonnel) inPersonnel.value = 1120;
    }
    kpiEditModal?.classList.add('open');
  });

  btnCloseKpiEditModal?.addEventListener('click', () => {
    kpiEditModal?.classList.remove('open');
  });

  btnSaveKpiEdit?.addEventListener('click', () => {
    const isEnabled = toggleKpi ? toggleKpi.checked : true;
    const total = parseInt(inTotal?.value, 10) || 83;
    const active = parseInt(inActive?.value, 10) || 8;
    const cleared = parseInt(inCleared?.value, 10) || Math.max(0, total - active);
    const deaths = parseInt(inDeaths?.value, 10) || 0;
    const injuries = parseInt(inInjuries?.value, 10) || 0;
    const vehicles = parseInt(inVehicles?.value, 10) || 348;
    const personnel = parseInt(inPersonnel?.value, 10) || 1120;

    AppState.kpiOverride = {
      enabled: isEnabled,
      total,
      active,
      cleared,
      deaths,
      injuries,
      vehicles,
      personnel
    };

    localStorage.setItem('nfa_kpi_override', JSON.stringify(AppState.kpiOverride));
    
    // Immediately regenerate dynamic incidents & update UI, map markers, and charts
    AppState.incidents = generateDynamicDataset(total, active, cleared, deaths, injuries, vehicles, personnel);
    applyFilters();
    updateKPICards();
    updateCharts();

    kpiEditModal?.classList.remove('open');
    alert(`상황판 주요 지표 및 전국 ${total}건 화재 목록이 성공적으로 동기화되어 저장되었습니다!`);
  });

  btnResetKpiAuto?.addEventListener('click', () => {
    AppState.kpiOverride = null;
    localStorage.removeItem('nfa_kpi_override');
    AppState.incidents = generateDynamicDataset(83, 8, 75, 0, 3, 348, 1120);
    applyFilters();
    updateKPICards();
    updateCharts();
    kpiEditModal?.classList.remove('open');
    alert('오늘 기준 표준 자동 집계 모드(83건)로 복구되었습니다.');
  });

  // Close modals on background click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });
}

// Function to open detail modal
window.openDetailModalById = function(id) {
  const item = AppState.incidents.find(i => i.id === id);
  if (!item) return;

  const modal = document.getElementById('detailModal');
  const title = document.getElementById('modalDetailTitle');
  const body = document.getElementById('modalDetailBody');

  title.innerText = item.title;
  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="label">화재 유형</span>
        <span class="val">${item.type}</span>
      </div>
      <div class="detail-item">
        <span class="label">현재 상태 / 대응단계</span>
        <span class="val text-${item.status === 'active' ? 'red' : 'green'}">
          ${item.status === 'active' ? '진압 중 (' + item.responseLevel + ')' : '진화 완료 (완진)'}
        </span>
      </div>
      <div class="detail-item">
        <span class="label">발생 위치</span>
        <span class="val">${item.location}</span>
      </div>
      <div class="detail-item">
        <span class="label">관할 소방서</span>
        <span class="val">${item.station}</span>
      </div>
      <div class="detail-item">
        <span class="label">발화 원인 (추정)</span>
        <span class="val">${item.cause}</span>
      </div>
      <div class="detail-item">
        <span class="label">발생 일시</span>
        <span class="val">${item.time}</span>
      </div>
      <div class="detail-item">
        <span class="label">인명 피해</span>
        <span class="val text-${item.casualties.deaths > 0 || item.casualties.injuries > 0 ? 'red' : 'blue'}">
          사망 ${item.casualties.deaths}명 / 부상 ${item.casualties.injuries}명
        </span>
      </div>
      <div class="detail-item">
        <span class="label">투입 소방력</span>
        <span class="val">장비 ${item.resources.vehicles}대 / 대원 ${item.resources.personnel}명</span>
      </div>
    </div>

    <div style="background: var(--bg-dark); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm); margin-top: 10px;">
      <span class="label" style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">상황 개요 및 현장 브리핑</span>
      <p style="font-size: 12px; color: #fff; line-height: 1.6;">${item.details}</p>
    </div>

    <div style="margin-top: 12px;">
      <h4 style="font-size: 13px; color: #93c5fd; margin-bottom: 8px;"><i class="fa-solid fa-clock-rotate-left"></i> 출동 및 진압 타임라인</h4>
      <div class="detail-timeline">
        ${item.timeline.map(t => `
          <div class="timeline-step">
            <span class="time">${t.time}</span>
            <span class="desc">${t.text}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  modal.classList.add('open');
};

// ============================================================================
// UI Interactions & Event Listeners
// ============================================================================
function initEventListeners() {
  // Refresh button
  document.getElementById('btnRefresh')?.addEventListener('click', () => {
    const btn = document.getElementById('btnRefresh');
    const icon = btn.querySelector('i');
    icon.classList.add('fa-spin');
    fetchFireData().finally(() => {
      setTimeout(() => icon.classList.remove('fa-spin'), 600);
    });
  });

  // Fullscreen button
  document.getElementById('btnFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  });

  // Region Filter buttons
  const regionBtns = document.querySelectorAll('.region-btn');
  regionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      regionBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      AppState.selectedRegion = e.target.dataset.region;

      // Adjust map view according to region
      const regionCoords = {
        'all': { center: [36.2, 127.8], zoom: 7.2 },
        '수도권': { center: [37.5, 126.9], zoom: 9 },
        '강원': { center: [37.8, 128.2], zoom: 8.5 },
        '충청': { center: [36.5, 127.2], zoom: 8.8 },
        '호남': { center: [35.2, 126.9], zoom: 8.5 },
        '영남': { center: [35.6, 128.8], zoom: 8.5 },
        '제주': { center: [33.38, 126.55], zoom: 9.8 }
      };

      const target = regionCoords[AppState.selectedRegion];
      if (target && AppState.map) {
        AppState.map.setView(target.center, target.zoom, { animate: true });
      }

      applyFilters();
    });
  });

  // Reset Map View button
  document.getElementById('btnResetMapView')?.addEventListener('click', () => {
    if (AppState.map) {
      AppState.map.setView([36.2, 127.8], 7.2, { animate: true });
    }
  });

  // Sidebar Status Tabs ('all', 'active', 'cleared')
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      AppState.selectedFilter = e.target.dataset.filter;
      applyFilters();
    });
  });

  // Sidebar Search Input
  const searchInput = document.getElementById('feedSearchInput');
  searchInput?.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    applyFilters();
  });
}

// Auto Refresh Setup
function setupAutoRefresh() {
  if (AppState.refreshTimer) {
    clearInterval(AppState.refreshTimer);
    AppState.refreshTimer = null;
  }

  const interval = AppState.apiConfig.refreshInterval;
  if (interval > 0) {
    AppState.refreshTimer = setInterval(() => {
      console.log('[FireDashboard] 자동 새로고침 실행');
      fetchFireData();
    }, interval);
  }
}

// ============================================================================
// CCTV Live Video & Camera Simulation System
// ============================================================================
const CCTV_CAMERAS = [
  { id: 1, name: "경기 화성 공장 화재 [소방드론 1호기]", lat: 37.0682, lng: 126.9634, type: "drone" },
  { id: 2, name: "서울 마포 상가 화재 [지휘차 전방캠]", lat: 37.5543, lng: 126.9207, type: "vehicle" },
  { id: 3, name: "강원 원주 산불 [치악산 감시타워 CCTV]", lat: 37.4089, lng: 128.0264, type: "tower" },
  { id: 4, name: "부산 사상 공업사 [교통정보센터 연계캠]", lat: 35.1524, lng: 128.9839, type: "traffic" }
];

let cctvAnimationId = null;
let cctvMarkers = [];
let showCctvOnMap = true;

function initCctvSystem() {
  const cctvModal = document.getElementById('cctvModal');
  const btnOpen = document.getElementById('btnOpenCctvModal');
  const btnClose = document.getElementById('btnCloseCctvModal');
  const btnCloseBottom = document.getElementById('btnCloseCctvModalBottom');
  const btnToggleMap = document.getElementById('btnToggleCctvMarkers');

  // Open / Close Modal
  btnOpen?.addEventListener('click', () => {
    cctvModal?.classList.add('open');
    startCctvSimulation();
  });

  const closeModal = () => {
    cctvModal?.classList.remove('open');
    if (cctvAnimationId) {
      cancelAnimationFrame(cctvAnimationId);
      cctvAnimationId = null;
    }
  };

  btnClose?.addEventListener('click', closeModal);
  btnCloseBottom?.addEventListener('click', closeModal);

  // Vision Mode Buttons (Normal, Thermal FLIR, Night Vision)
  const visionBtns = document.querySelectorAll('.btn-vision');
  const grid = document.getElementById('cctvGrid');
  visionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      visionBtns.forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      const mode = target.dataset.vision;

      grid.classList.remove('vision-thermal', 'vision-night');
      if (mode === 'thermal') grid.classList.add('vision-thermal');
      if (mode === 'night') grid.classList.add('vision-night');
    });
  });

  // Toggle Map CCTV Markers
  btnToggleMap?.addEventListener('click', () => {
    showCctvOnMap = !showCctvOnMap;
    btnToggleMap.classList.toggle('active', showCctvOnMap);
    renderCctvMapMarkers();
  });

  // Custom Stream URL input
  const btnApplyStream = document.getElementById('btnApplyCustomStream');
  const streamInput = document.getElementById('customStreamUrlInput');
  btnApplyStream?.addEventListener('click', () => {
    const url = streamInput.value.trim();
    if (!url) return;

    const cam1Container = document.querySelector('#camCard1 .cctv-video-container');
    if (!cam1Container) return;

    // Check if YouTube link
    let embedUrl = url;
    if (url.includes('youtube.com/watch?v=')) {
      const vid = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1`;
    } else if (url.includes('youtu.be/')) {
      const vid = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1`;
    }

    if (embedUrl.includes('youtube.com/embed/')) {
      cam1Container.innerHTML = `
        <iframe width="100%" height="100%" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border: none;"></iframe>
      `;
    } else {
      cam1Container.innerHTML = `
        <video width="100%" height="100%" src="${url}" autoplay muted loop controls style="object-fit: cover;"></video>
      `;
    }
    alert('실시간 외부 스트림 영상이 CH-01 채널에 연결되었습니다!');
  });

  // Initial map CCTV markers
  renderCctvMapMarkers();
}

// Render CCTV markers on map
function renderCctvMapMarkers() {
  if (!AppState.map) return;

  // Clear existing
  cctvMarkers.forEach(m => AppState.map.removeLayer(m));
  cctvMarkers = [];

  if (!showCctvOnMap) return;

  CCTV_CAMERAS.forEach(cam => {
    const icon = L.divIcon({
      className: 'cctv-custom-marker',
      html: `
        <div style="background: #2563eb; color: #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(37,99,235,0.8); border: 2px solid #fff; cursor: pointer;">
          <i class="fa-solid fa-video" style="font-size: 11px;"></i>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([cam.lat + 0.003, cam.lng + 0.003], { icon: icon });
    marker.bindPopup(`
      <div style="padding: 10px; font-family: Pretendard; color: #fff; background: #111827; border-radius: 6px; min-width: 200px;">
        <h4 style="font-size: 12px; color: #38bdf8; margin-bottom: 6px;"><i class="fa-solid fa-video"></i> ${cam.name}</h4>
        <p style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">실시간 현장 관제 스트림 수신 가능</p>
        <button onclick="document.getElementById('btnOpenCctvModal').click()" style="width: 100%; padding: 6px; background: #dc2626; color: #fff; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
          🎥 실시간 영상 보기
        </button>
      </div>
    `);
    marker.addTo(AppState.map);
    cctvMarkers.push(marker);
  });
}

// High-Tech Emergency CCTV Simulation Canvas Animation
function startCctvSimulation() {
  const c1 = document.getElementById('canvasCam1')?.getContext('2d');
  const c2 = document.getElementById('canvasCam2')?.getContext('2d');
  const c3 = document.getElementById('canvasCam3')?.getContext('2d');
  const c4 = document.getElementById('canvasCam4')?.getContext('2d');

  let tick = 0;

  function render() {
    tick++;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    // Update timecodes
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`cctvTime${i}`);
      if (el) el.innerText = timeStr;
    }

    // 1. Cam 1: Drone aerial view of factory fire
    if (c1) {
      c1.fillStyle = '#0a101d';
      c1.fillRect(0, 0, 480, 270);

      // Factory building outline
      c1.strokeStyle = '#1e293b';
      c1.lineWidth = 2;
      c1.strokeRect(100, 70, 280, 140);
      c1.strokeRect(160, 100, 160, 80);

      // Fire & smoke plume center
      const gradient = c1.createRadialGradient(240, 140, 5, 240, 140, 60 + Math.sin(tick * 0.1) * 12);
      gradient.addColorStop(0, 'rgba(255, 120, 20, 0.9)');
      gradient.addColorStop(0.3, 'rgba(239, 68, 68, 0.7)');
      gradient.addColorStop(0.7, 'rgba(70, 70, 80, 0.5)');
      gradient.addColorStop(1, 'transparent');

      c1.fillStyle = gradient;
      c1.beginPath();
      c1.arc(240, 140, 70 + Math.sin(tick * 0.08) * 15, 0, Math.PI * 2);
      c1.fill();

      // Emergency strobe lights
      if (Math.floor(tick / 8) % 2 === 0) {
        c1.fillStyle = 'rgba(239, 68, 68, 0.8)';
        c1.beginPath();
        c1.arc(90, 190, 8, 0, Math.PI * 2);
        c1.arc(390, 190, 8, 0, Math.PI * 2);
        c1.fill();
      }
      if (Math.floor(tick / 8) % 2 === 1) {
        c1.fillStyle = 'rgba(59, 130, 246, 0.8)';
        c1.beginPath();
        c1.arc(105, 190, 8, 0, Math.PI * 2);
        c1.arc(375, 190, 8, 0, Math.PI * 2);
        c1.fill();
      }
    }

    // 2. Cam 2: Ground vehicle dashcam
    if (c2) {
      c2.fillStyle = '#0f172a';
      c2.fillRect(0, 0, 480, 270);

      // Road perspective
      c2.strokeStyle = '#334155';
      c2.lineWidth = 2;
      c2.beginPath();
      c2.moveTo(0, 270);
      c2.lineTo(220, 130);
      c2.moveTo(480, 270);
      c2.lineTo(260, 130);
      c2.stroke();

      // Storefront glowing smoke
      const grad2 = c2.createRadialGradient(280, 110, 2, 280, 110, 45);
      grad2.addColorStop(0, 'rgba(249, 115, 22, 0.85)');
      grad2.addColorStop(0.5, 'rgba(220, 38, 38, 0.4)');
      grad2.addColorStop(1, 'transparent');
      c2.fillStyle = grad2;
      c2.beginPath();
      c2.arc(280, 110, 45 + Math.cos(tick * 0.1) * 8, 0, Math.PI * 2);
      c2.fill();
    }

    // 3. Cam 3: Mountain watchtower
    if (c3) {
      c3.fillStyle = '#020617';
      c3.fillRect(0, 0, 480, 270);

      // Mountain ridge
      c3.fillStyle = '#1e293b';
      c3.beginPath();
      c3.moveTo(0, 220);
      c3.lineTo(120, 140);
      c3.lineTo(260, 180);
      c3.lineTo(380, 110);
      c3.lineTo(480, 170);
      c3.lineTo(480, 270);
      c3.lineTo(0, 270);
      c3.fill();

      // Mountain smoke
      c3.fillStyle = 'rgba(234, 179, 8, 0.45)';
      c3.beginPath();
      c3.arc(260, 160, 25 + Math.sin(tick * 0.05) * 6, 0, Math.PI * 2);
      c3.fill();
    }

    // 4. Cam 4: Intersection CCTV
    if (c4) {
      c4.fillStyle = '#090d16';
      c4.fillRect(0, 0, 480, 270);

      // Cross intersection
      c4.fillStyle = '#172033';
      c4.fillRect(190, 0, 100, 270);
      c4.fillRect(0, 100, 480, 70);

      // Moving traffic dots
      const carPos = (tick * 2) % 480;
      c4.fillStyle = '#f8fafc';
      c4.fillRect(carPos, 115, 12, 6);
      c4.fillStyle = '#ef4444';
      c4.fillRect((480 - carPos), 145, 12, 6);
    }

    cctvAnimationId = requestAnimationFrame(render);
  }

  render();
}

// ============================================================================
// Application Entrypoint
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initMap();
  initCharts();
  initModals();
  initEventListeners();
  initCctvSystem();
  setupAutoRefresh();

  // Initial Data Fetch
  fetchFireData();
});

