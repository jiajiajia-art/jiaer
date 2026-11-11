/* 娱乐圈 · 星城舆图视觉（模组槽 map）：底图、各地实景照片、手摆点位。 */
import type { MapVisuals } from "../../mods/types";

const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&h=520&fit=crop&auto=format&q=80`;
const ROOM_IMAGE: Record<string, string> = {
  apartment: U("1680416124510-5eae1beca412"),
  bookstore: U("1699443817739-cf2f7cbcd18d"),
  redcarpet: U("1779696413497-ed3af0ac7161"),
  lounge: U("1756981168649-0e3c3c8a32f3"),
  gym: U("1761971976282-b2bb051a5474"),
  street: U("1601042879364-f3947d3f9c16"),
  beauty: U("1706629503634-2de20b65080e"),
  cafe: U("1624583338957-4d155ca886dc"),
  dieyin: U("1531651008558-ed1740375b39"),
  academy: U("1501684399321-1dc61aaea760"),
  agency: U("1686100510540-4c29a46de6e9"),
  wardrobe: U("1771919318996-f5ebc2319881"),
  yuntai: U("1684285746670-3d2eeed72192"),
  cancan: U("1612544409025-e1f6a56c1152"),
  airport: U("1553619948-505cc1cdc320"),
  theater: U("1514306191717-452ec28c7814"),
  fuguang: U("1780913363783-59bb4357e277"),
  fours: U("1567818735868-e71b99932e29"),
  park: U("1691805802587-ecac05c8194f"),
  outdoorset: U("1695564947363-c8f7da482873"),
  makeup: U("1623090351083-90cce8ec842e"),
  tvstage: "https://images.unsplash.com/flagged/photo-1590425113058-3a2678b4cdad?w=900&h=520&fit=crop&auto=format&q=80",
  nightbar: U("1701836923465-01b5e1ed9b04"),
  fanbase: U("1786418288949-8347e08eceb3"),
  hotel: U("1646991761123-d83ce47c30c9"),
};

/* 原型图 12 个节点坐标与定制名称定义 */
const PANORAMA_DEFAULT_POS = {
  // 左区：社区与读书 (0% ~ 25%)
  bookstore: { x: 6, y: 38, label: "黑碟书店" },
  apartment: { x: 18, y: 48, label: "天光小区" }, // 主点位

  // 中左区：街区与娱乐 (25% ~ 50%)
  fours: { x: 31, y: 22, label: "星空 45 号" },
  street: { x: 39, y: 62, label: "星桥商业街" },
  theater: { x: 48, y: 56, label: "影院 CINEMA" },

  // 中右区：会所与练习馆 (50% ~ 75%)
  redcarpet: { x: 58, y: 41, label: "红橙会客厅" },
  gym: { x: 67, y: 32, label: "星桥练习馆" },
  lounge: { x: 76, y: 26, label: "云顶私人会所" },

  // 右区：演艺与传媒产业 (75% ~ 95%)
  fuguang: { x: 82, y: 62, label: "摄影棚" },
  dieyin: { x: 90, y: 53, label: "录音棚" },
  yuntai: { x: 95, y: 38, label: "传媒城" },
};

const SINGLE_DEFAULT_POS = {
  bookstore: { x: 8, y: 34, label: "黑碟书店" },
  apartment: { x: 14, y: 50, label: "天光小区" },
  fours: { x: 38, y: 22, label: "星空 45 号" },
  street: { x: 20, y: 62, label: "星桥商业街" },
  theater: { x: 46, y: 62, label: "影院 CINEMA" },
  redcarpet: { x: 60, y: 41, label: "红橙会客厅" },
  lounge: { x: 75, y: 28, label: "云顶私人会所" },
  gym: { x: 88, y: 34, label: "星桥练习馆" },
  fuguang: { x: 68, y: 58, label: "摄影棚" },
  dieyin: { x: 88, y: 58, label: "录音棚" },
  yuntai: { x: 91, y: 46, label: "传媒城" },
};


export const ENT_MAP: MapVisuals = {
  background: new URL("../../imports/5eee1b86244583edcb74f0b437b1aead.webp", import.meta.url).href,
  backgroundAlt: "星城全景地图",
  photos: ROOM_IMAGE,
  defaultPhoto: U("1684285746670-3d2eeed72192"),
  hotspots: { panorama: PANORAMA_DEFAULT_POS, single: SINGLE_DEFAULT_POS },
};
