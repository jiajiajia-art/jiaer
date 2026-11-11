/* 地点图标库：内置线描 SVG（存为 data URI，和上传图标同一渲染通道），玩家可自选；也可上传自己的 .svg */
const P: Record<string, [string, string]> = {
  home: ["家", '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'],
  shop: ["商店", '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5 0 3 3 0 0 1-6 0 3 3 0 0 1-5 0z"/><path d="M5 12v8h14v-8"/>'],
  cafe: ["咖啡", '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 3v3M12 3v3"/>'],
  food: ["餐厅", '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 2-2 6 0 8v10"/>'],
  school: ["学校", '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'],
  office: ["公司", '<rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'],
  studio: ["片场", '<rect x="3" y="7" width="13" height="11" rx="1"/><path d="M16 11l5-3v9l-5-3"/>'],
  stage: ["舞台", '<path d="M3 20h18M5 20V9M19 20V9"/><path d="M3 5c3 4 6 4 9 0 3 4 6 4 9 0"/>'],
  music: ["音乐", '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'],
  park: ["公园", '<path d="M12 21v-6"/><path d="M12 3l-5 7h3l-4 5h12l-4-5h3z"/>'],
  hospital: ["医院", '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>'],
  bar: ["酒吧", '<path d="M5 4h14l-7 8z"/><path d="M12 12v8M8 20h8"/>'],
  hotel: ["酒店", '<path d="M3 20V6M3 13h18v7M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10" r="2"/>'],
  station: ["车站", '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>'],
  car: ["车行", '<path d="M3 16v-4l2-5h14l2 5v4z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>'],
  gym: ["健身", '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>'],
  temple: ["古建", '<path d="M2 8c4 0 7-2 10-4 3 2 6 4 10 4"/><path d="M5 8v12h14V8M4 13h16M10 20v-4h4v4"/>'],
  beach: ["海边", '<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5S16 18 18 18s2-1.5 4-1.5"/><circle cx="16" cy="7" r="3"/>'],
  heart: ["约会", '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>'],
  star: ["地标", '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'],
  book: ["书店", '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>'],
  moon: ["夜场", '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>'],
  key: ["密室", '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/>'],
  pin: ["其他", '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'],
};
const svg = (body: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)}`;
export const ICON_COLORS = ["#2f2a26", "#2f7d6b", "#d0644f", "#b8892f", "#5b5fa8", "#ffffff"];
export const SPOT_ICONS = Object.entries(P).map(([id, [label, body]]) => ({ id, label, body }));
export const spotIconUri = (body: string, color: string) => svg(body, color);
