/** Evidence icons, drawn in code into 16×16 textures. One function per item id. */
export const ITEM = { w: 16, h: 16 } as const;

type Painter = (ctx: CanvasRenderingContext2D) => void;

const INK = '#1a1a2e';

function path(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string, stroke = INK): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

const PAINTERS: Record<string, Painter> = {
  tornLetter: (ctx) => {
    path(
      ctx,
      [
        [3, 1.5],
        [12.5, 1.5],
        [12.5, 10],
        [11, 12],
        [9, 10.5],
        [7, 13],
        [5, 11],
        [3, 13.5],
      ],
      '#f1e9d2',
    );
    ctx.fillStyle = '#6b5a4a';
    for (const y of [4, 6, 8]) ctx.fillRect(5, y, 6 - (y === 8 ? 2 : 0), 1);
  },
  cellarKey: (ctx) => {
    ctx.strokeStyle = '#e0b84a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(5, 5, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, 7);
    ctx.lineTo(14, 14);
    ctx.moveTo(11, 11);
    ctx.lineTo(13, 9);
    ctx.moveTo(13, 13);
    ctx.lineTo(15, 11);
    ctx.stroke();
    ctx.strokeStyle = '#8a6a1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(5, 5, 4, 0, Math.PI * 2);
    ctx.stroke();
  },
  bloodiedCloth: (ctx) => {
    path(
      ctx,
      [
        [2, 4],
        [6, 2],
        [10, 4],
        [14, 3],
        [13, 8],
        [14, 13],
        [9, 12],
        [5, 14],
        [2, 11],
        [3, 7],
      ],
      '#ece6da',
    );
    ctx.fillStyle = '#9b1b2a';
    ctx.beginPath();
    ctx.arc(8, 7, 2.6, 0, Math.PI * 2);
    ctx.arc(10.5, 9.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  },
  photograph: (ctx) => {
    ctx.fillStyle = '#3a2819';
    ctx.fillRect(1.5, 2.5, 13, 11);
    ctx.fillStyle = '#d9d0b8';
    ctx.fillRect(3, 4, 10, 8);
    ctx.fillStyle = '#6e8ba3';
    ctx.fillRect(3, 4, 10, 4);
    ctx.fillStyle = '#2d2d3a';
    ctx.beginPath();
    ctx.arc(8, 8, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(6.5, 9.5, 3, 2.5);
  },
  poisonVial: (ctx) => {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(6.5, 1, 3, 3);
    path(
      ctx,
      [
        [6, 4],
        [10, 4],
        [10, 7],
        [12.5, 11],
        [12, 14.5],
        [4, 14.5],
        [3.5, 11],
        [6, 7],
      ],
      '#4fd18b',
    );
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(5, 9, 1.5, 4);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(8, 11, 1.5, 0, Math.PI * 2);
    ctx.fill();
  },
  gloves: (ctx) => {
    for (const [ox, flip] of [
      [1, 1],
      [15, -1],
    ] as const) {
      ctx.save();
      ctx.translate(ox, 0);
      ctx.scale(flip, 1);
      path(
        ctx,
        [
          [1, 7],
          [1.5, 4],
          [3, 4],
          [3.5, 6],
          [4, 2.5],
          [5.5, 2.5],
          [6, 6],
          [7, 5],
          [7, 10],
          [6, 14],
          [1.5, 14],
          [0.5, 10],
        ],
        '#e8dcc2',
      );
      ctx.restore();
    }
  },
};

export function drawItem(ctx: CanvasRenderingContext2D, id: string): void {
  const paint = PAINTERS[id];
  if (paint) return paint(ctx);
  ctx.fillStyle = '#f3f1ee';
  ctx.fillRect(3, 3, 10, 10);
  ctx.fillStyle = INK;
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('?', 5.5, 11);
}
