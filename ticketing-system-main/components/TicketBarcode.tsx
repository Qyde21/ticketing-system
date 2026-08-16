'use client';

const CODE128: string[] = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','1100011101011',
];
const START_B = 104;

function encodeCode128B(text: string): string {
  const values: number[] = [START_B];
  let checksum = START_B;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const val = code >= 32 && code <= 127 ? code - 32 : 0;
    values.push(val);
    checksum += val * (i + 1);
  }
  values.push(checksum % 103);
  let bars = '';
  for (const v of values) bars += CODE128[v] ?? CODE128[0];
  bars += CODE128[106];
  return bars;
}

export default function TicketBarcode({
  value,
  height = 110,
  moduleWidth = 3,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
}) {
  const clean = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z\-_]/g, '');
  if (!clean) return null;

  const pattern = encodeCode128B(clean);
  const quiet = 10;
  const modules = quiet * 2 + pattern.length;
  const width = modules * moduleWidth;
  const barHeight = height - 22;
  const offset = quiet * moduleWidth;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Barcode ${clean}`}
        style={{
          display: 'block',
          background: '#ffffff',
          borderRadius: 6,
          minWidth: Math.min(width, 360),
          maxWidth: '100%',
          height: 'auto',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {Array.from(pattern).map((bit, i) =>
          bit === '1' ? (
            <rect
              key={i}
              x={offset + i * moduleWidth}
              y={4}
              width={moduleWidth}
              height={barHeight}
              fill="#000000"
            />
          ) : null
        )}
        <text
          x={width / 2}
          y={height - 4}
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={14}
          fontWeight={700}
          fill="#111111"
        >
          {clean}
        </text>
      </svg>
    </div>
  );
}
