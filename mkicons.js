// 의존성 없이 PNG 아이콘 2개 생성 (192, 512) — 어두운 배경 + 코랄 지도 핀
const fs = require("fs");
const zlib = require("zlib");

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

function png(w, h, rgba) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function make(size) {
  const w = size, h = size;
  const buf = Buffer.alloc(w * h * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const R = size * 0.20;              // 모서리 라운드
  const cx = w / 2, pinTopY = h * 0.30, pinR = size * 0.20, tipY = h * 0.78;
  const holeR = pinR * 0.42;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 배경: 라운드 사각형 #12141b, 밖은 투명
      let inBg = true;
      const dxl = R - x, dxr = x - (w - 1 - R), dyt = R - y, dyb = y - (h - 1 - R);
      if (dxl > 0 && dyt > 0) inBg = dxl * dxl + dyt * dyt <= R * R;
      else if (dxr > 0 && dyt > 0) inBg = dxr * dxr + dyt * dyt <= R * R;
      else if (dxl > 0 && dyb > 0) inBg = dxl * dxl + dyb * dyb <= R * R;
      else if (dxr > 0 && dyb > 0) inBg = dxr * dxr + dyb * dyb <= R * R;
      if (!inBg) { set(x, y, 0, 0, 0, 0); continue; }
      set(x, y, 0x12, 0x14, 0x1b, 255);

      // 핀 몸통: 위쪽 원 + 아래 삼각형
      const dcx = x - cx, dcy = y - pinTopY;
      let inPin = dcx * dcx + dcy * dcy <= pinR * pinR;
      if (!inPin && y >= pinTopY) {
        // 삼각형: (cx-pinR*k, pinTopY) ~ (cx+pinR*k, pinTopY) ~ (cx, tipY)
        const prog = (y - pinTopY) / (tipY - pinTopY);
        if (prog >= 0 && prog <= 1) {
          const half = pinR * (1 - prog) * 0.92;
          if (Math.abs(dcx) <= half) inPin = true;
        }
      }
      if (inPin) {
        // 코랄
        set(x, y, 0xe0, 0x7a, 0x5f, 255);
        // 가운데 구멍(배경색)
        if (dcx * dcx + dcy * dcy <= holeR * holeR) set(x, y, 0x12, 0x14, 0x1b, 255);
      }
    }
  }
  return png(w, h, buf);
}

fs.writeFileSync("C:/Claude/gi-build/icon-192.png", make(192));
fs.writeFileSync("C:/Claude/gi-build/icon-512.png", make(512));
console.log("icons written:",
  fs.statSync("C:/Claude/gi-build/icon-192.png").size, "/",
  fs.statSync("C:/Claude/gi-build/icon-512.png").size, "bytes");
