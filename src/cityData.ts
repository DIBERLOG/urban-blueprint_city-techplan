export type Point = { x: number; y: number };

export type ZoneData = {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RoadData = {
  id: string;
  label?: string;
  width: number;
  major?: boolean;
  points: Point[];
};

export type BuildingForm =
  | "rect"
  | "l"
  | "u"
  | "oct"
  | "t"
  | "courtyard"
  | "trapezoid"
  | "rotunda"
  | "corner-block"
  | "segmented-bar"
  | "depot"
  | "sawtooth"
  | "cemetery"
  | "plaza"
  | "tree-cluster"
  | "buffer-strip"
  | "park"
  | "harbor"
  | "piers"
  | "h"
  | "cross"
  | "hex"
  | "tower"
  | "stadium"
  | "terrace"
  | "parking"
  | "pond"
  | "square"
  | "forest"
  | "garden";

export type BuildingData = {
  id: string;
  zoneId: string;
  label: string;
  color: string;
  form: BuildingForm;
  rotation?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cutWidth?: number;
  cutHeight?: number;
  gapWidth?: number;
  gapDepth?: number;
  radius?: number;
  neckWidth?: number;
  wingDepth?: number;
  innerInset?: number;
  topWidth?: number;
  segmentCount?: number;
  bayCount?: number;
  doubleFrame?: boolean;
  textX?: number;
  textY?: number;
};

export type GateData = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  textDx?: number;
  textDy?: number;
};

export type OverlayId = "legend" | "stamp";

export type OverlayState = {
  showLegend: boolean;
  showTitleStamp: boolean;
  legendPosition: Point;
  stampPosition: Point;
};

export type MapState = {
  title: string;
  zones: ZoneData[];
  roads: RoadData[];
  buildings: BuildingData[];
  gates: GateData[];
  overlays: OverlayState;
};

export const initialZones: ZoneData[] = [
  { id: "residence", title: "ИМПЕРАТОРСКАЯ РЕЗИДЕНЦИЯ", color: "#fbbf24", x: 80, y: 90, width: 599, height: 349 },
  { id: "elite", title: "ЭЛИТНЫЙ РАЙОН", color: "#f59e0b", x: 90, y: 470, width: 603, height: 620 },
  { id: "admin", title: "АДМИНИСТРАТИВНЫЙ ЦЕНТР", color: "#06b6d4", x: 692, y: 90, width: 627, height: 1329 },
  { id: "port", title: "ТОРГОВО-ПОРТОВЫЙ РАЙОН", color: "#10b981", x: 1440, y: 70, width: 413, height: 997 },
  { id: "outskirts", title: "ОКРАИННЫЙ РАЙОН", color: "#ef4444", x: 1430, y: 1070, width: 406, height: 299 },
  { id: "industrial", title: "ПРОМЫШЛЕННАЯ ЗОНА", color: "#8b5cf6", x: 1440, y: 1380, width: 398, height: 264 },
];

export const initialRoads: RoadData[] = [
  { id: "west-main", label: "ЗАПАДНАЯ МАГИСТРАЛЬ", width: 34, major: true, points: [{ x: 42, y: 1463 }, { x: 1822, y: 1460 }] },
  { id: "reform-ave", label: "ПРОСПЕКТ РЕФОРМ", width: 28, major: true, points: [{ x: 1299, y: 168 }, { x: 1301, y: 1485 }] },
  { id: "central-route", label: "ЦЕНТРАЛЬНЫЙ ТРАКТ", width: 30, major: true, points: [{ x: 1040, y: 168 }, { x: 1037, y: 1648 }] },
  { id: "port-passage", label: "ПОРТОВОЙ ПРОЕЗД", width: 28, major: true, points: [{ x: 1583, y: 135 }, { x: 1589, y: 1646 }] },
  { id: "road-1776183710566", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 738, y: 165 }, { x: 1029, y: 428 }] },
  { id: "road-1776183725325", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 794, y: 141 }, { x: 1244, y: 139 }] },
  { id: "road-1776184081919", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1123, y: 444 }, { x: 1272, y: 444 }] },
  { id: "road-1776184083629", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 84, y: 453 }, { x: 926, y: 450 }] },
  { id: "road-1776189867676", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1298, y: 744 }, { x: 1033, y: 436 }] },
  { id: "road-1776189869236", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 719, y: 752 }, { x: 1024, y: 448 }] },
  { id: "road-1776190200744", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 89, y: 758 }, { x: 1302, y: 752 }] },
  { id: "road-1776191853479", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1037, y: 1016 }, { x: 1595, y: 700 }] },
  { id: "road-1776192094434", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 702, y: 1011 }, { x: 445, y: 761 }] },
  { id: "road-1776192094838", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 441, y: 753 }, { x: 408, y: 459 }] },
  { id: "road-1776192095026", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1826, y: 1199 }, { x: 718, y: 1192 }] },
  { id: "road-1776192095210", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1031, y: 1016 }, { x: 718, y: 765 }] },
  { id: "road-1776192095326", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1034, y: 1022 }, { x: 53, y: 1022 }] },
  { id: "road-1776192963904", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1038, y: 435 }, { x: 1295, y: 167 }] },
  { id: "road-1776193180542", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1343, y: 137 }, { x: 1877, y: 134 }] },
  { id: "road-1776193180971", label: "НОВАЯ ДОРОГА", width: 18, major: true, points: [{ x: 1358, y: 446 }, { x: 1886, y: 442 }] },
  { id: "road-1776193316324", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 1455, y: 891 }, { x: 1451, y: 1188 }] },
  { id: "road-1776193698338", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 1764, y: 925 }, { x: 1594, y: 926 }] },
  { id: "road-1776193698602", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 1830, y: 1026 }, { x: 1595, y: 1026 }] },
  { id: "road-1776193961584", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 1453, y: 891 }, { x: 1590, y: 812 }] },
  { id: "road-1776193977292", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 1454, y: 1301 }, { x: 1454, y: 1196 }] },
  { id: "road-1776193982640", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 1567, y: 1417 }, { x: 1457, y: 1312 }] },
  { id: "road-1776194010457", label: "НОВАЯ МАГИСТРАЛЬ", width: 30, major: true, points: [{ x: 1586, y: 636 }, { x: 1826, y: 636 }] },
  { id: "road-1776194023023", label: "НОВАЯ МАГИСТРАЛЬ", width: 30, major: true, points: [{ x: 1821, y: 74 }, { x: 1822, y: 635 }] },
  { id: "road-1776194869694", label: "Шелковый путь миров", width: 30, major: true, points: [{ x: 738, y: 134 }, { x: 722, y: 1441 }] },
  { id: "road-1776195251185", label: "НОВАЯ ДОРОГА", width: 18, major: false, points: [{ x: 411, y: 93 }, { x: 410, y: 444 }] },
];

export const initialBuildings: BuildingData[] = [
  { id: "trees-1", zoneId: "residence", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 580, y: 190, width: 72, height: 96 },
  { id: "park-1", zoneId: "residence", label: "ПАРК", color: "#22c55e", form: "park", x: 260, y: 350, width: 124, height: 72 },
  { id: "palace", zoneId: "residence", label: "ДВОРЕЦ", color: "#fbbf24", form: "u", x: 210, y: 150, width: 210, height: 130, gapWidth: 90, gapDepth: 70, textY: 220, rotation: -90 },
  { id: "orangery", zoneId: "residence", label: "ОРАНЖЕРЕЯ", color: "#fbbf24", form: "oct", x: 440, y: 170, width: 108, height: 108, radius: 54 },
  { id: "stable", zoneId: "residence", label: "КОНЮШНЯ", color: "#fbbf24", form: "l", x: 80, y: 110, width: 135, height: 105, cutWidth: 78, cutHeight: 45 },
  { id: "guards", zoneId: "residence", label: "КАЗАРМЫ ГВАРДИИ", color: "#fbbf24", form: "rect", x: 470, y: 360, width: 168, height: 56 },
  { id: "gardens", zoneId: "residence", label: "ИМП. САДЫ", color: "#7dd3a7", form: "rect", x: 560, y: 160, width: 88, height: 120 },
  { id: "parade-garden", zoneId: "residence", label: "ПАРАДНЫЙ САД", color: "#7dd3fc", form: "rect", x: 260, y: 350, width: 124, height: 72, textY: 408 },
  { id: "elite-church", zoneId: "elite", label: "ЦЕРКОВЬ", color: "#f59e0b", form: "oct", x: 320, y: 920, width: 84, height: 84, radius: 42 },
  { id: "hotel-a", zoneId: "elite", label: "ОТЕЛЬ А", color: "#f59e0b", form: "l", x: 260, y: 620, width: 145, height: 115, cutWidth: 80, cutHeight: 52 },
  { id: "hotel-b", zoneId: "elite", label: "ОТЕЛЬ Б", color: "#f59e0b", form: "trapezoid", x: 510, y: 610, width: 120, height: 108, cutWidth: 70, cutHeight: 45, rotation: 17, neckWidth: 43, wingDepth: 45, topWidth: 86 },
  { id: "elite-home-a", zoneId: "elite", label: "ЖИЛЬЕ I", color: "#f59e0b", form: "u", x: 360, y: 820, width: 175, height: 118, gapWidth: 78, gapDepth: 58, rotation: 45 },
  { id: "elite-home-b", zoneId: "elite", label: "ЖИЛЬЕ II", color: "#f59e0b", form: "u", x: 480, y: 480, width: 175, height: 118, gapWidth: 82, gapDepth: 60 },
  { id: "flower-shop", zoneId: "elite", label: "ЦВЕТОЧНЫЙ", color: "#f59e0b", form: "rect", x: 530, y: 940, width: 92, height: 40, rotation: 40 },
  { id: "booksellers-elite", zoneId: "elite", label: "КНИЖНИКИ", color: "#f59e0b", form: "rect", x: 500, y: 790, width: 94, height: 40, rotation: 45 },
  { id: "cafe-elite", zoneId: "elite", label: "КАФЕ", color: "#f59e0b", form: "rect", x: 630, y: 770, width: 64, height: 40 },
  { id: "jeweler", zoneId: "elite", label: "ЮВЕЛИР", color: "#f59e0b", form: "trapezoid", x: 650, y: 910, width: 70, height: 40, rotation: -90, innerInset: 9, topWidth: 50, segmentCount: 4, bayCount: 4 },
  { id: "tailor", zoneId: "elite", label: "ПОРТНОЙ", color: "#f59e0b", form: "rect", x: 630, y: 1040, width: 78, height: 40 },
  { id: "clinic", zoneId: "elite", label: "КЛИНИКА", color: "#f59e0b", form: "rect", x: 490, y: 1040, width: 128, height: 36 },
  { id: "parliament", zoneId: "admin", label: "ПАРЛАМЕНТ", color: "#06b6d4", form: "courtyard", x: 950, y: 110, width: 170, height: 64, innerInset: 12 },
  { id: "cityhall", zoneId: "admin", label: "МЭРИЯ", color: "#06b6d4", form: "rect", x: 680, y: 110, width: 115, height: 64 },
  { id: "court", zoneId: "admin", label: "СУД", color: "#06b6d4", form: "rect", x: 1240, y: 110, width: 100, height: 64 },
  { id: "bank", zoneId: "admin", label: "БАНК", color: "#06b6d4", form: "trapezoid", x: 1020, y: 630, width: 130, height: 52, topWidth: 96, rotation: 90 },
  { id: "main-church", zoneId: "admin", label: "ГЛАВНАЯ ЦЕРКОВЬ", color: "#06b6d4", form: "oct", x: 1240, y: 380, width: 116, height: 116, radius: 58 },
  { id: "theatre", zoneId: "admin", label: "ТЕАТР", color: "#06b6d4", form: "oct", x: 680, y: 410, width: 96, height: 96, radius: 48 },
  { id: "gallery", zoneId: "admin", label: "ГОРОДСКАЯ ГАЛЕРЕЯ", color: "#06b6d4", form: "rect", x: 1090, y: 960, width: 188, height: 58, cutWidth: 98, cutHeight: 26, rotation: -30, topWidth: 135, segmentCount: 6, bayCount: 4 },
  { id: "library", zoneId: "admin", label: "БИБЛИОТЕКА", color: "#06b6d4", form: "rect", x: 1050, y: 1050, width: 130, height: 52, rotation: 90 },
  { id: "archive", zoneId: "admin", label: "АРХИВ", color: "#06b6d4", form: "rect", x: 920, y: 640, width: 130, height: 40, rotation: 90 },
  { id: "migration", zoneId: "admin", label: "БЮРО МИГРАЦИИ", color: "#06b6d4", form: "rect", x: 800, y: 770, width: 180, height: 48 },
  { id: "newspaper", zoneId: "admin", label: "ПЕЧАТНОЕ ИЗДАНИЕ", color: "#06b6d4", form: "trapezoid", x: 1170, y: 970, width: 180, height: 46, rotation: -90, topWidth: 130 },
  { id: "arch-bureau", zoneId: "admin", label: "АРХИТЕКТУРНОЕ БЮРО", color: "#06b6d4", form: "rect", x: 1080, y: 780, width: 188, height: 46 },
  { id: "post", zoneId: "admin", label: "ПОЧТАМТ", color: "#06b6d4", form: "rect", x: 1130, y: 690, width: 78, height: 46 },
  { id: "telegraph", zoneId: "admin", label: "ТЕЛЕГРАФ", color: "#06b6d4", form: "rect", x: 840, y: 680, width: 92, height: 46 },
  { id: "police", zoneId: "admin", label: "ПОЛИЦИЯ", color: "#06b6d4", form: "rect", x: 720, y: 1080, width: 105, height: 52, rotation: 90 },
  { id: "fire", zoneId: "admin", label: "ПОЖАРНАЯ", color: "#06b6d4", form: "rect", x: 890, y: 1080, width: 122, height: 52, rotation: 90 },
  { id: "block-1", zoneId: "admin", label: "БЛОК 01", color: "#06b6d4", form: "rect", x: 780, y: 960, width: 145, height: 38 },
  { id: "block-2", zoneId: "admin", label: "БЛОК 02", color: "#06b6d4", form: "rect", x: 700, y: 900, width: 145, height: 38, rotation: 90 },
  { id: "block-3", zoneId: "admin", label: "БЛОК 03", color: "#06b6d4", form: "rect", x: 740, y: 1220, width: 150, height: 42 },
  { id: "block-4", zoneId: "admin", label: "БЛОК 04", color: "#06b6d4", form: "rect", x: 1090, y: 880, width: 150, height: 42, rotation: -30 },
  { id: "main-square", zoneId: "admin", label: "ГЛАВНАЯ ПЛОЩАДЬ", color: "#06b6d4", form: "plaza", x: 920, y: 320, width: 230, height: 230 },
  { id: "market", zoneId: "port", label: "РЫНОК", color: "#10b981", form: "rect", x: 1300, y: 530, width: 96, height: 46, rotation: 90 },
  { id: "shops", zoneId: "port", label: "МАГАЗИНЫ", color: "#10b981", form: "rect", x: 1330, y: 850, width: 103, height: 46, rotation: -30 },
  { id: "pharmacy", zoneId: "port", label: "АПТЕКА", color: "#10b981", form: "rect", x: 1460, y: 470, width: 96, height: 42 },
  { id: "barber", zoneId: "port", label: "ПАРИКМАХЕР", color: "#10b981", form: "rect", x: 1440, y: 780, width: 114, height: 42, rotation: -30 },
  { id: "inn", zoneId: "port", label: "ТРАКТИР", color: "#10b981", form: "rect", x: 1600, y: 480, width: 72, height: 44, rotation: 90 },
  { id: "cafe-port", zoneId: "port", label: "КАФЕ", color: "#10b981", form: "rect", x: 1390, y: 380, width: 64, height: 44 },
  { id: "booksellers-port", zoneId: "port", label: "КНИЖНИКИ", color: "#10b981", form: "rect", x: 1480, y: 580, width: 80, height: 44 },
  { id: "detective", zoneId: "port", label: "ДЕТЕКТИВ", color: "#10b981", form: "rect", x: 1610, y: 380, width: 95, height: 42 },
  { id: "hotel-port-a", zoneId: "port", label: "ОТЕЛЬ А", color: "#10b981", form: "trapezoid", x: 1300, y: 1090, width: 92, height: 42, rotation: 90, topWidth: 66 },
  { id: "hotel-port-b", zoneId: "port", label: "ОТЕЛЬ Б", color: "#10b981", form: "rect", x: 1470, y: 380, width: 95, height: 42 },
  { id: "institute", zoneId: "port", label: "ИНСТИТУТ", color: "#10b981", form: "courtyard", x: 1300, y: 970, width: 100, height: 42, innerInset: 10, rotation: 90 },
  { id: "brewery", zoneId: "port", label: "ПИВОВАРНЯ", color: "#10b981", form: "rect", x: 1610, y: 570, width: 110, height: 42 },
  { id: "builder", zoneId: "port", label: "СТРОЙМАГАЗИН", color: "#10b981", form: "rect", x: 1330, y: 710, width: 225, height: 42, rotation: -30 },
  { id: "customs", zoneId: "port", label: "ТАМОЖНЯ", color: "#10b981", form: "rect", x: 1330, y: 1140, width: 102, height: 42 },
  { id: "exchange", zoneId: "port", label: "БИРЖА", color: "#10b981", form: "rect", x: 1480, y: 870, width: 86, height: 42, rotation: -30 },
  { id: "insurance", zoneId: "port", label: "СТРАХОВАЯ", color: "#10b981", form: "trapezoid", x: 1250, y: 700, width: 201, height: 42, topWidth: 154, rotation: 90 },
  { id: "harbor", zoneId: "port", label: "НАБЕРЕЖНАЯ И ПОРТ", color: "#10b981", form: "harbor", x: 1600, y: 650, width: 245, height: 255 },
  { id: "piers", zoneId: "port", label: "ПРИЧАЛЫ", color: "#86efac", form: "piers", x: 1780, y: 710, width: 90, height: 170 },
  { id: "shipyard", zoneId: "port", label: "ВЕРФЬ", color: "#10b981", form: "rect", x: 1760, y: 910, width: 92, height: 46 },
  { id: "warehouse-a", zoneId: "port", label: "СКЛАД А", color: "#10b981", form: "segmented-bar", x: 1690, y: 710, width: 88, height: 46, segmentCount: 3 },
  { id: "warehouse-b", zoneId: "port", label: "СКЛАД Б", color: "#10b981", form: "segmented-bar", x: 1690, y: 770, width: 88, height: 46, segmentCount: 3 },
  { id: "fish-market", zoneId: "port", label: "РЫБНЫЙ РЫНОК", color: "#10b981", form: "rect", x: 1580, y: 730, width: 95, height: 42, rotation: 90 },
  { id: "tavern", zoneId: "port", label: "ТАВЕРНА", color: "#10b981", form: "rect", x: 1580, y: 840, width: 90, height: 40, rotation: 90 },
  { id: "boats", zoneId: "port", label: "ЛОДОЧНОЕ ДЕПО", color: "#10b981", form: "depot", x: 1660, y: 830, width: 112, height: 40, bayCount: 4 },
  { id: "lighthouse", zoneId: "port", label: "МАЯК", color: "#10b981", form: "oct", x: 1790, y: 950, width: 52, height: 52, radius: 26 },
  { id: "prison", zoneId: "outskirts", label: "ТЮРЬМА", color: "#ef4444", form: "rect", x: 1710, y: 1230, width: 110, height: 58, doubleFrame: true },
  { id: "cemetery", zoneId: "outskirts", label: "КЛАДБИЩЕ", color: "#ef4444", form: "cemetery", x: 1710, y: 1090, width: 118, height: 74 },
  { id: "cemetery-church", zoneId: "outskirts", label: "ЦЕРКОВЬ", color: "#ef4444", form: "oct", x: 1600, y: 1040, width: 56, height: 56, radius: 28 },
  { id: "morgue", zoneId: "outskirts", label: "МОРГ", color: "#ef4444", form: "rect", x: 1600, y: 1130, width: 82, height: 42 },
  { id: "slaughter", zoneId: "outskirts", label: "СКОТОБОЙНЯ", color: "#ef4444", form: "rect", x: 1610, y: 980, width: 92, height: 42 },
  { id: "tannery", zoneId: "outskirts", label: "КОЖЕВНЯ", color: "#ef4444", form: "rect", x: 1610, y: 940, width: 92, height: 40, rotation: 0 },
  { id: "gambling", zoneId: "outskirts", label: "ИГОРНЫЙ ДОМ", color: "#ef4444", form: "rect", x: 1470, y: 1130, width: 95, height: 36 },
  { id: "poor-housing-a", zoneId: "outskirts", label: "ЖИЛЬЕ А", color: "#ef4444", form: "rect", x: 1610, y: 1220, width: 70, height: 36 },
  { id: "poor-housing-b", zoneId: "outskirts", label: "ЖИЛЬЕ Б", color: "#ef4444", form: "rect", x: 1480, y: 1220, width: 70, height: 36 },
  { id: "worker-inn", zoneId: "outskirts", label: "РАБОЧИЙ ТРАКТИР", color: "#ef4444", form: "rect", x: 1470, y: 1300, width: 100, height: 36, rotation: 40 },
  { id: "mine", zoneId: "industrial", label: "ШАХТА", color: "#8b5cf6", form: "rect", x: 1610, y: 1500, width: 92, height: 44 },
  { id: "cryo", zoneId: "industrial", label: "КРИОСТАНЦИЯ", color: "#8b5cf6", form: "rect", x: 1720, y: 1490, width: 118, height: 44 },
  { id: "water", zoneId: "industrial", label: "ВОДООЧИСТИТ.", color: "#8b5cf6", form: "rect", x: 1720, y: 1370, width: 118, height: 42 },
  { id: "foundry", zoneId: "industrial", label: "ЛИТЕЙНЫЙ ЗАВОД", color: "#8b5cf6", form: "sawtooth", x: 1680, y: 510, width: 112, height: 42, bayCount: 4 },
  { id: "sawmill", zoneId: "industrial", label: "ЛЕСОПИЛКА", color: "#8b5cf6", form: "rect", x: 1470, y: 1550, width: 104, height: 38 },
  { id: "coal", zoneId: "industrial", label: "УГОЛЬНЫЙ СКЛАД", color: "#8b5cf6", form: "rect", x: 1610, y: 1560, width: 126, height: 38 },
  { id: "warehouses", zoneId: "industrial", label: "СКЛАДЫ", color: "#8b5cf6", form: "rect", x: 1680, y: 470, width: 120, height: 28 },
  { id: "park-1776184108595", zoneId: "admin", label: "ПАРК", color: "#22c55e", form: "park", x: 880, y: 180, width: 120, height: 80, rotation: 15 },
  { id: "park-1776184155528", zoneId: "admin", label: "ПАРК", color: "#22c55e", form: "park", x: 1050, y: 180, width: 120, height: 80 },
  { id: "building-1776189924164", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1140, y: 380, width: 130, height: 24 },
  { id: "building-1776189924452", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 760, y: 310, width: 130, height: 24 },
  { id: "building-1776189924652", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 780, y: 370, width: 130, height: 24 },
  { id: "building-1776189936520", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1180, y: 540, width: 130, height: 24 },
  { id: "building-1776189936920", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1180, y: 310, width: 130, height: 24 },
  { id: "building-1776189945718", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1150, y: 480, width: 130, height: 24 },
  { id: "building-1776189945898", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 780, y: 490, width: 130, height: 24 },
  { id: "building-1776189949586", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 750, y: 550, width: 130, height: 24 },
  { id: "building-1776190235879", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 990, y: 780, width: 28, height: 150 },
  { id: "building-1776190236251", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 680, y: 190, width: 28, height: 150 },
  { id: "building-1776190257925", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 680, y: 290, width: 28, height: 150 },
  { id: "building-1776190258221", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 680, y: 520, width: 28, height: 150 },
  { id: "building-1776190258421", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1450, y: 180, width: 28, height: 150 },
  { id: "building-1776190258597", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1390, y: 180, width: 28, height: 150 },
  { id: "building-1776190258773", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1510, y: 170, width: 28, height: 150 },
  { id: "building-1776190258937", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1730, y: 190, width: 28, height: 150 },
  { id: "building-1776191991330", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1330, y: 1220, width: 28, height: 150 },
  { id: "building-1776191991510", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1260, y: 1220, width: 28, height: 150 },
  { id: "building-1776191991686", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 980, y: 1220, width: 28, height: 150 },
  { id: "building-1776191991866", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1060, y: 1210, width: 28, height: 150 },
  { id: "building-1776191992050", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1060, y: 1030, width: 28, height: 150 },
  { id: "building-1776191992206", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 990, y: 1040, width: 28, height: 150 },
  { id: "building-1776191992358", zoneId: "admin", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1060, y: 780, width: 28, height: 150 },
  { id: "park-1776193341680", zoneId: "port", label: "ПАРК", color: "#22c55e", form: "park", x: 1440, y: 530, width: 120, height: 40, rotation: 90 },
  { id: "building-1776193914695", zoneId: "port", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1650, y: 150, width: 28, height: 150 },
  { id: "building-1776193914871", zoneId: "port", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1390, y: 580, width: 28, height: 150 },
  { id: "building-1776193915047", zoneId: "port", label: "ДЕРЕВЬЯ", color: "#6ee7b7", form: "tree-cluster", x: 1400, y: 470, width: 28, height: 150 },
  { id: "park-1776260136124", zoneId: "admin", label: "СКВЕР", color: "#22c55e", form: "square", x: 380, y: 1250, width: 120, height: 100, rotation: 0 },
];

export const initialGates: GateData[] = [
  { id: "gate-west", label: "ЗАПАДНЫЕ ВОРОТА", x: 62, y: 852, width: 48, height: 92, rotation: 0, textDx: 60, textDy: 54 },
  { id: "gate-north", label: "СЕВЕРНЫЕ ВОРОТА", x: 1006, y: 78, width: 70, height: 62, rotation: 0, textDx: 92, textDy: 46 },
  { id: "gate-south", label: "ЮЖНЫЕ ВОРОТА", x: 1004, y: 1608, width: 70, height: 62, rotation: 180, textDx: 92, textDy: -12 },
];

export const initialOverlays: OverlayState = {
  showLegend: true,
  showTitleStamp: true,
  legendPosition: { x: 84, y: 1560 },
  stampPosition: { x: 775, y: 1580 },
};

export const initialMapState: MapState = {
  title: "Технический генплан города",
  zones: initialZones,
  roads: initialRoads,
  buildings: initialBuildings,
  gates: initialGates,
  overlays: initialOverlays,
};

export function cloneMapState(mapState: MapState): MapState {
  return structuredClone(mapState);
}
