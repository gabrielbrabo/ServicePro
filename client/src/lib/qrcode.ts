// ---------------------------------------------------------------------------
// Gerador de QR Code (Model 2) — SEM dependencias externas. Modo byte (UTF-8),
// selecao automatica de versao (1..40) e nivel de correcao configuravel.
// Retorna a matriz de modulos (boolean[][]) para renderizar como SVG/canvas.
//
// Implementacao propria (algoritmo publico). Validada por decodificacao
// (jsQR) em 200+ casos aleatorios e nas URLs reais do app, em L/M/Q/H.
// ---------------------------------------------------------------------------

export type Ecc = "L" | "M" | "Q" | "H";

const ECC: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
// bits do indicador de nivel no format info (L=01, M=00, Q=11, H=10)
const ECC_FORMAT_BITS: Record<number, number> = { 0: 1, 1: 0, 2: 3, 3: 2 };

const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
];

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function getNumDataCodewords(ver: number, ecl: number): number {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
  );
}

// ---- Reed-Solomon (GF(2^8), 0x11D) ----
function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsComputeDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}
function rsComputeRemainder(data: number[], divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i++) {
      result[i] ^= rsMultiply(divisor[i], factor);
    }
  }
  return result;
}

function appendBits(val: number, len: number, bb: number[]): void {
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}
function utf8Bytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

function chooseVersion(dataBytes: number[], ecl: number): number {
  for (let ver = 1; ver <= 40; ver++) {
    const dataCapacityBits = getNumDataCodewords(ver, ecl) * 8;
    const charCountBits = ver < 10 ? 8 : 16;
    const usedBits = 4 + charCountBits + dataBytes.length * 8;
    if (usedBits <= dataCapacityBits) return ver;
  }
  throw new Error("Conteudo longo demais para um QR Code");
}

function addEccAndInterleave(
  dataCodewords: number[],
  ver: number,
  ecl: number
): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const rsDiv = rsComputeDivisor(blockEccLen);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = dataCodewords.slice(k, k + datLen);
    k += datLen;
    const ecc = rsComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // placeholder (removido no intercalado)
    const block = dat.slice();
    for (const b of ecc) block.push(b);
    blocks.push(block);
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

export interface QrResult {
  modules: boolean[][];
  size: number;
  version: number;
}

export function makeQr(text: string, eclName: Ecc = "M"): QrResult {
  const ecl = ECC[eclName];
  const dataBytes = utf8Bytes(text);
  const ver = chooseVersion(dataBytes, ecl);
  const size = ver * 4 + 17;

  const bb: number[] = [];
  appendBits(0x4, 4, bb);
  const charCountBits = ver < 10 ? 8 : 16;
  appendBits(dataBytes.length, charCountBits, bb);
  for (const b of dataBytes) appendBits(b, 8, bb);

  const dataCapacityBits = getNumDataCodewords(ver, ecl) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - (bb.length % 8)) % 8, bb);
  for (let pad = 0xec; bb.length < dataCapacityBits; pad ^= 0xec ^ 0x11)
    appendBits(pad, 8, bb);

  const dataCodewords: number[] = [];
  for (let i = 0; i < bb.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb[i + j];
    dataCodewords.push(byte);
  }

  const allCodewords = addEccAndInterleave(dataCodewords, ver, ecl);

  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );
  const isFn: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );

  const setFn = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFn[y][x] = true;
  };
  const drawFinder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
          setFn(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  };

  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  const alignPositions = ((): number[] => {
    if (ver === 1) return [];
    const num = Math.floor(ver / 7) + 2;
    const step =
      ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < num; p -= step) pos.splice(1, 0, p);
    return pos;
  })();
  const drawAlign = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };
  for (let i = 0; i < alignPositions.length; i++) {
    for (let j = 0; j < alignPositions.length; j++) {
      const isCorner =
        (i === 0 && j === 0) ||
        (i === 0 && j === alignPositions.length - 1) ||
        (i === alignPositions.length - 1 && j === 0);
      if (!isCorner) drawAlign(alignPositions[i], alignPositions[j]);
    }
  }

  // reserva as areas de format info + o modulo sempre escuro (timing preservado)
  const reserveFormat = () => {
    for (let x = 0; x <= 8; x++) if (x !== 6) setFn(x, 8, false);
    for (let y = 0; y <= 8; y++) if (y !== 6) setFn(8, y, false);
    for (let x = size - 8; x < size; x++) setFn(x, 8, false);
    for (let y = size - 7; y < size; y++) setFn(8, y, false);
    setFn(8, size - 8, true);
  };
  reserveFormat();

  if (ver >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, false);
      setFn(b, a, false);
    }
  }

  // dados em zig-zag
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let k2 = 0; k2 < 2; k2++) {
        const x = right - k2;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && i < allCodewords.length * 8) {
          modules[y][x] =
            ((allCodewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  const maskFns: Array<(x: number, y: number) => boolean> = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x, _y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!isFn[y][x] && maskFns[mask](x, y)) modules[y][x] = !modules[y][x];
  };

  const drawFormatBits = (mask: number) => {
    const data = (ECC_FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let j = 0; j < 10; j++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const get = (b: number) => ((bits >>> b) & 1) !== 0;
    for (let j = 0; j <= 5; j++) modules[j][8] = get(j);
    modules[7][8] = get(6);
    modules[8][8] = get(7);
    modules[8][7] = get(8);
    for (let j = 9; j < 15; j++) modules[8][14 - j] = get(j);
    for (let j = 0; j < 8; j++) modules[8][size - 1 - j] = get(j);
    for (let j = 8; j < 15; j++) modules[size - 15 + j][8] = get(j);
    modules[size - 8][8] = true;
  };

  const drawVersion = () => {
    if (ver < 7) return;
    let rem = ver;
    for (let j = 0; j < 12; j++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let j = 0; j < 18; j++) {
      const bit = ((bits >>> j) & 1) !== 0;
      const a = size - 11 + (j % 3);
      const b = Math.floor(j / 3);
      modules[b][a] = bit;
      modules[a][b] = bit;
    }
  };
  drawVersion();

  const penalty = (): number => {
    let p = 0;
    for (let y = 0; y < size; y++) {
      let run = 1;
      for (let x = 1; x < size; x++) {
        if (modules[y][x] === modules[y][x - 1]) {
          run++;
          if (run === 5) p += 3;
          else if (run > 5) p++;
        } else run = 1;
      }
    }
    for (let x = 0; x < size; x++) {
      let run = 1;
      for (let y = 1; y < size; y++) {
        if (modules[y][x] === modules[y - 1][x]) {
          run++;
          if (run === 5) p += 3;
          else if (run > 5) p++;
        } else run = 1;
      }
    }
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (
          c === modules[y][x + 1] &&
          c === modules[y + 1][x] &&
          c === modules[y + 1][x + 1]
        )
          p += 3;
      }
    const patA = [true,false,true,true,true,false,true,false,false,false,false];
    const patB = [false,false,false,false,true,false,true,true,true,false,true];
    const scan = (grid: boolean[][]) => {
      for (let y = 0; y < size; y++)
        for (let x = 0; x <= size - 11; x++) {
          let okA = true, okB = true;
          for (let m = 0; m < 11; m++) {
            if (grid[y][x + m] !== patA[m]) okA = false;
            if (grid[y][x + m] !== patB[m]) okB = false;
          }
          if (okA) p += 40;
          if (okB) p += 40;
        }
    };
    scan(modules);
    const trans: boolean[][] = Array.from({ length: size }, (_, x) =>
      Array.from({ length: size }, (_, y) => modules[y][x])
    );
    scan(trans);
    let dark = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
    const percent = (dark * 100) / (size * size);
    p += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return p;
  };

  let bestMask = 0, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormatBits(mask);
    const pen = penalty();
    if (pen < bestPenalty) {
      bestPenalty = pen;
      bestMask = mask;
    }
    applyMask(mask); // desfaz
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);

  return { modules, size, version: ver };
}

// Constroi um atributo `d` de <path> SVG com um quadrado por modulo escuro.
// Cada modulo tem 1 unidade; use viewBox="0 0 size size" (mais quiet zone).
export function qrSvgPath(modules: boolean[][]): string {
  const parts: string[] = [];
  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules.length; x++) {
      if (modules[y][x]) parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return parts.join("");
}
