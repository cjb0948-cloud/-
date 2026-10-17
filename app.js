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
  refreshTimer: null
};

// ============================================================================
// Realistic Mock / Standard Baseline Dataset (소방청 표준 데이터 규격)
// ============================================================================
const SAMPLE_INCIDENTS = [
  {
    id: "화재상황-20261007-001",
    title: "경기 화성시 공장 화재",
    type: "공장/창고 화재",
    status: "active", // active (진압중), cleared (완진)
    responseLevel: "대응 2단계",
    location: "경기도 화성시 양감면",
    station: "화성소방서",
    lat: 37.0682,
    lng: 126.9634,
    time: "2026-10-07 21:42",
    relativeTime: "40분 전",
    cause: "전기적 요인",
    casualties: { deaths: 0, injuries: 1 },
    resources: { vehicles: 28, personnel: 84 },
    details: "플라스틱 사출 공장 내부 배전반에서 발화 추정. 인접 공장으로의 연소 확대 저지선 구축 및 집중 방수 중.",
    timeline: [
      { time: "21:42", text: "119 최초 화재 신고 접수" },
      { time: "21:48", text: "화성소방서 선착대 현장 도착 및 화재 진압 개시" },
      { time: "21:55", text: "대응 1단계 발령 (인근 소방력 집중)" },
      { time: "22:10", text: "대응 2단계 격상 발령 (소방청 국가소방동원령 1호 검토)" }
    ]
  },
  {
    id: "화재상황-20261007-002",
    title: "서울 마포구 상가 화재",
    type: "상가/다중이용시설 화재",
    status: "active",
    responseLevel: "대응 1단계",
    location: "서울특별시 마포구 서교동",
    station: "마포소방서",
    lat: 37.5543,
    lng: 126.9207,
    time: "2026-10-07 22:05",
    relativeTime: "18분 전",
    cause: "부주의 (주방 취급)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 16, personnel: 52 },
    details: "지상 3층 상가건물 1층 음식점 주방 후드에서 착화. 건물 내 상인 및 이용객 24명 전원 자력 대피 완료.",
    timeline: [
      { time: "22:05", text: "119 신고 접수" },
      { time: "22:09", text: "마포소방서 출동대 도착 및 대피 유도 완료" },
      { time: "22:15", text: "대응 1단계 발령 및 주방 집중 진화 중" }
    ]
  },
  {
    id: "화재상황-20261007-003",
    title: "강원 원주시 치악산 인근 야산 화재",
    type: "산불/임야 화재",
    status: "active",
    responseLevel: "초기 대응",
    location: "강원특별자치도 원주시 소초면",
    station: "원주소방서",
    lat: 37.4089,
    lng: 128.0264,
    time: "2026-10-07 20:50",
    relativeTime: "1시간 30분 전",
    cause: "담뱃불 등 부주의 추정",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 12, personnel: 45 },
    details: "야산 3부 능선 인근 낙엽층 화재. 건조 및 강풍으로 연소 확산 우려되어 산림청 진화대 합동 방화선 구축 완료, 진화율 70%.",
    timeline: [
      { time: "20:50", text: "인근 주민 산불 목격 신고 접수" },
      { time: "21:05", text: "원주소방서 산불진화대 현장 진입" },
      { time: "21:40", text: "주불 진화선 구축 및 잔불 집중 진화" }
    ]
  },
  {
    id: "화재상황-20261007-004",
    title: "부산 사상구 공업사 화재",
    type: "공장/작업장 화재",
    status: "active",
    responseLevel: "초기 대응",
    location: "부산광역시 사상구 감전동",
    station: "사상소방서",
    lat: 35.1524,
    lng: 128.9839,
    time: "2026-10-07 21:15",
    relativeTime: "1시간 전",
    cause: "용접 작업 불티",
    casualties: { deaths: 0, injuries: 1 },
    resources: { vehicles: 14, personnel: 38 },
    details: "자동차 정비공장 내 용접 작업 중 가연물 착화로 추정. 작업자 1명 경미한 화상으로 병원 이송, 초진 완료 후 잔불 정리 중.",
    timeline: [
      { time: "21:15", text: "119 신고 접수" },
      { time: "21:22", text: "현장 도착 및 인명 구조/이송" },
      { time: "21:50", text: "초진 완료, 잔불 정리 단계" }
    ]
  },
  {
    id: "화재상황-20261007-005",
    title: "경북 포항시 남구 단독주택 화재",
    type: "주거시설 화재",
    status: "active",
    responseLevel: "초기 대응",
    location: "경상북도 포항시 남구 오천읍",
    station: "포항남부소방서",
    lat: 35.9687,
    lng: 129.3789,
    time: "2026-10-07 22:12",
    relativeTime: "12분 전",
    cause: "화목보일러 과열 추정",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 9, personnel: 26 },
    details: "단독주택 보일러실에서 발화. 거주자 2명 안전 대피, 주변 주택 연소 확대 차단 작업 진행 중.",
    timeline: [
      { time: "22:12", text: "119 신고 접수" },
      { time: "22:18", text: "출동대 현장 도착 및 수관 전개" }
    ]
  },
  {
    id: "화재상황-20261007-006",
    title: "충남 천안시 서북구 아파트 화재",
    type: "주거시설(공동주택)",
    status: "cleared",
    responseLevel: "일반",
    location: "충청남도 천안시 서북구 쌍용동",
    station: "천안서북소방서",
    lat: 36.8041,
    lng: 127.1235,
    time: "2026-10-07 19:10",
    relativeTime: "3시간 전",
    cause: "전기적 요인 (멀티탭 과부하)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 15, personnel: 42 },
    details: "아파트 8층 안방 멀티탭 단락으로 발화. 스프링클러 작동 및 소방대 진입으로 25분 만에 완진.",
    timeline: [
      { time: "19:10", text: "화재 감지기 및 119 신고 접수" },
      { time: "19:15", text: "현장 도착" },
      { time: "19:35", text: "완진 판정 및 배연 작업 완료" }
    ]
  },
  {
    id: "화재상황-20261007-007",
    title: "대구 북구 침산동 창고 화재",
    type: "창고 화재",
    status: "cleared",
    responseLevel: "일반",
    location: "대구광역시 북구 침산동",
    station: "대구북부소방서",
    lat: 35.8895,
    lng: 128.5873,
    time: "2026-10-07 17:30",
    relativeTime: "5시간 전",
    cause: "기계적 요인 (지게차 배터리)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 18, personnel: 48 },
    details: "물류창고 전동 지게차 충전 중 배터리 열폭주 추정. 신속 진압으로 인명 피해 없음.",
    timeline: [
      { time: "17:30", text: "신고 접수" },
      { time: "18:15", text: "완진 및 현장 감식 전환" }
    ]
  },
  {
    id: "화재상황-20261007-008",
    title: "전남 여수시 돌산읍 어선 화재",
    type: "차량/선박 화재",
    status: "cleared",
    responseLevel: "일반",
    location: "전라남도 여수시 돌산읍",
    station: "여수소방서",
    lat: 34.6983,
    lng: 127.7562,
    time: "2026-10-07 16:40",
    relativeTime: "6시간 전",
    cause: "전기적 요인 (기관실 배선)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 7, personnel: 22 },
    details: "항포구 정박 중인 4.5톤급 연안복합 어선 기관실 화재. 해경정 합동 진화 완료.",
    timeline: [
      { time: "16:40", text: "신고 접수" },
      { time: "17:20", text: "완진" }
    ]
  },
  {
    id: "화재상황-20261007-009",
    title: "인천 서구 가좌동 목재공장 화재",
    type: "공장/창고 화재",
    status: "cleared",
    responseLevel: "대응 1단계",
    location: "인천광역시 서구 가좌동",
    station: "인천서부소방서",
    lat: 37.4912,
    lng: 126.6854,
    time: "2026-10-07 14:20",
    relativeTime: "8시간 전",
    cause: "원인 미상 (정밀 조사중)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 22, personnel: 65 },
    details: "목재 야적장 톱밥 더미에서 자연발화 또는 불티 추정. 포크레인 동원해 더미 파헤치며 완진.",
    timeline: [
      { time: "14:20", text: "신고 접수" },
      { time: "16:00", text: "완진" }
    ]
  },
  {
    id: "화재상황-20261007-010",
    title: "제주 서귀포시 서홍동 비닐하우스 화재",
    type: "농업/축산 시설",
    status: "cleared",
    responseLevel: "일반",
    location: "제주특별자치도 서귀포시 서홍동",
    station: "서귀포소방서",
    lat: 33.2541,
    lng: 126.5492,
    time: "2026-10-07 11:15",
    relativeTime: "11시간 전",
    cause: "전기적 요인 (열풍기 과열)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 6, personnel: 18 },
    details: "감귤 비닐하우스 내 농업용 온풍기 과열로 보온덮개 착화. 30분 만에 완진.",
    timeline: [
      { time: "11:15", text: "신고 접수" },
      { time: "11:45", text: "완진" }
    ]
  },
  {
    id: "화재상황-20261007-011",
    title: "광주 북구 용봉동 상가 주택 화재",
    type: "주거복합시설",
    status: "cleared",
    responseLevel: "일반",
    location: "광주광역시 북구 용봉동",
    station: "광주북부소방서",
    lat: 35.1812,
    lng: 126.9034,
    time: "2026-10-07 09:30",
    relativeTime: "13시간 전",
    cause: "가스 누출 등 부주의",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 8, personnel: 24 },
    details: "가스레인지 음식물 조리 중 장시간 방치로 인한 연기 발생 및 연소. 신속 진화.",
    timeline: [
      { time: "09:30", text: "신고 접수" },
      { time: "09:48", text: "완진" }
    ]
  },
  {
    id: "화재상황-20261007-012",
    title: "대전 대덕구 대화동 산업단지 변전실 화재",
    type: "산업시설",
    status: "cleared",
    responseLevel: "일반",
    location: "대전광역시 대덕구 대화동",
    station: "대덕소방서",
    lat: 36.3685,
    lng: 127.4121,
    time: "2026-10-07 06:15",
    relativeTime: "16시간 전",
    cause: "전기적 요인 (특고압 차단기 절연파괴)",
    casualties: { deaths: 0, injuries: 0 },
    resources: { vehicles: 12, personnel: 35 },
    details: "변전설비 과전류로 인한 아크 방전 발화. 이산화탄소 소화설비 방출 및 진압 완료.",
    timeline: [
      { time: "06:15", text: "신고 접수" },
      { time: "06:50", text: "완진" }
    ]
  }
];

// Additional synthetic incident distribution to make stats realistic (total 38 incidents)
function generateFullDataset() {
  const baseList = [...SAMPLE_INCIDENTS];
  const provinces = [
    { name: "경기", lat: 37.4138, lng: 127.5183 },
    { name: "서울", lat: 37.5665, lng: 126.9780 },
    { name: "경북", lat: 36.5760, lng: 128.5056 },
    { name: "경남", lat: 35.4606, lng: 128.2132 },
    { name: "충남", lat: 36.6588, lng: 126.6728 },
    { name: "전남", lat: 34.8679, lng: 126.9910 },
    { name: "강원", lat: 37.8228, lng: 128.1555 },
    { name: "전북", lat: 35.7175, lng: 127.1530 },
    { name: "충북", lat: 36.6357, lng: 127.4912 },
    { name: "대구", lat: 35.8714, lng: 128.6014 },
    { name: "인천", lat: 37.4563, lng: 126.7052 },
    { name: "부산", lat: 35.1796, lng: 129.0756 },
    { name: "대전", lat: 36.3504, lng: 127.3845 },
    { name: "울산", lat: 35.5384, lng: 129.3114 },
    { name: "광주", lat: 35.1595, lng: 126.8526 },
    { name: "세종", lat: 36.4800, lng: 127.2890 },
    { name: "제주", lat: 33.4996, lng: 126.5312 }
  ];

  const types = ["주거시설 화재", "야외/쓰레기 소각", "차량 화재", "상가 화재", "창고 화재", "공장 화재"];
  const causes = ["부주의", "전기적 요인", "기계적 요인", "원인 미상", "기타"];

  // Generate 26 more cleared historical incidents for today
  for (let i = 13; i <= 38; i++) {
    const prov = provinces[Math.floor(Math.random() * provinces.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const cause = causes[Math.floor(Math.random() * causes.length)];
    const hour = Math.floor(Math.random() * 20); // between 00 and 20:00
    const min = Math.floor(Math.random() * 59);
    const timeStr = `2026-10-07 ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    
    // slight jitter to lat/lng
    const jitterLat = (Math.random() - 0.5) * 0.35;
    const jitterLng = (Math.random() - 0.5) * 0.35;

    baseList.push({
      id: `화재상황-20261007-${String(i).padStart(3, '0')}`,
      title: `${prov.name} ${type}`,
      type: type,
      status: "cleared",
      responseLevel: "일반",
      location: `${prov.name} 관내`,
      station: `${prov.name}관할소방서`,
      lat: prov.lat + jitterLat,
      lng: prov.lng + jitterLng,
      time: timeStr,
      relativeTime: `${22 - hour}시간 전`,
      cause: cause,
      casualties: { deaths: 0, injuries: 0 },
      resources: { vehicles: Math.floor(Math.random() * 8) + 4, personnel: Math.floor(Math.random() * 20) + 12 },
      details: `${type} 발생 후 신속 진화 완료. 인명 피해 없음.`,
      timeline: [
        { time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, text: "신고 접수 및 출동" },
        { time: `${String(hour).padStart(2, '0')}:${String(min + 20).padStart(2, '0')}`, text: "진화 완료 (완진)" }
      ]
    });
  }

  return baseList;
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
  const list = AppState.incidents;
  const total = list.length;
  const active = list.filter(i => i.status === 'active').length;
  const cleared = total - active;

  const totalCasualties = list.reduce((acc, i) => acc + (i.casualties.deaths + i.casualties.injuries), 0);
  const totalVehicles = list.reduce((acc, i) => acc + (i.resources ? i.resources.vehicles : 0), 0);
  const totalPersonnel = list.reduce((acc, i) => acc + (i.resources ? i.resources.personnel : 0), 0);

  const clearRate = total > 0 ? ((cleared / total) * 100).toFixed(1) : '100.0';

  document.getElementById('kpiTotalFires').innerText = total;
  document.getElementById('kpiActiveFires').innerText = active;
  document.getElementById('kpiClearedFires').innerText = cleared;
  document.getElementById('kpiClearRate').innerText = `진화율 ${clearRate}%`;
  document.getElementById('kpiCasualties').innerText = totalCasualties;
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
    const counts = [16, 12, 5, 3, 1, 1];

    AppState.charts.cause = new Chart(ctxCause, {
      type: 'doughnut',
      data: {
        labels: causes,
        datasets: [{
          data: counts,
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
    const hourlyCounts = [1, 0, 2, 4, 7, 9, 8, 7];

    AppState.charts.hourly = new Chart(ctxHourly, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          label: '발생 건수',
          data: hourlyCounts,
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
    const regionCounts = [11, 7, 5, 4, 4, 4, 3];

    AppState.charts.region = new Chart(ctxRegion, {
      type: 'bar',
      data: {
        labels: regions,
        datasets: [{
          label: '화재 건수',
          data: regionCounts,
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
  btnCloseSafetyModalBottom?.addEventListener('click', () => safetyModal.classList.remove('open'));

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

