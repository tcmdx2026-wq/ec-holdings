/**
 * Tọa độ 19 trung tâm + Văn phòng — nguồn: public/ToadoGiong.txt
 * (BẢNG TỌA ĐỘ 19 TRUNG TÂM - CÔNG TY CP GIONG VIỆT NAM, STT 0→19)
 * Key = mã trung tâm (centers.code). Cụm = cột "Cụm" trong file gốc.
 */
export type CenterCoord = {
  lat: number;
  lng: number;
  cluster: string;
};

export const CENTER_COORDS: Record<string, CenterCoord> = {
  VP: { lat: 21.04743328, lng: 105.8779599, cluster: "Long Biên" },
  NL: { lat: 21.04743328, lng: 105.8779599, cluster: "Long Biên" },
  LB: { lat: 21.06274423, lng: 105.8968746, cluster: "Long Biên" },
  "SĐ": { lat: 21.0358392, lng: 105.9102846, cluster: "Long Biên" },
  TS: { lat: 21.10976037, lng: 105.9593491, cluster: "Từ Sơn" },
  HM: { lat: 21.16045513, lng: 105.9289508, cluster: "Từ Sơn" },
  TD: { lat: 21.09928551, lng: 105.9840983, cluster: "Từ Sơn" },
  ML: { lat: 21.2028488, lng: 105.7020303, cluster: "Mê Linh" },
  TP: { lat: 21.15415979, lng: 105.7609146, cluster: "Mê Linh" },
  PY: { lat: 21.23089637, lng: 105.6930474, cluster: "Mê Linh" },
  "CĐ": { lat: 21.20798773, lng: 105.7530976, cluster: "Mê Linh" },
  "TĐ": { lat: 21.17857716, lng: 105.6777402, cluster: "Mê Linh" },
  TA: { lat: 21.11133274, lng: 105.7896167, cluster: "Mê Linh" },
  LM: { lat: 21.19099974, lng: 105.6448128, cluster: "Mê Linh" },
  "ĐX": { lat: 21.27740272, lng: 105.729285, cluster: "Mê Linh" },
  BH: { lat: 20.91020398, lng: 105.7607489, cluster: "Thanh Oai" },
  TO: { lat: 20.86523846, lng: 105.7607695, cluster: "Thanh Oai" },
  TT: { lat: 20.87130648, lng: 105.8052789, cluster: "Thanh Oai" },
  QO: { lat: 20.96891206, lng: 105.681553, cluster: "Thanh Oai" },
  "ĐY": { lat: 20.926094313766257, lng: 105.59689423171851, cluster: "Thanh Oai" },
};

/** Tọa độ của 1 trung tâm theo mã — null nếu không có trong bảng. */
export function getCenterCoord(code: string): CenterCoord | null {
  return CENTER_COORDS[code] ?? null;
}
