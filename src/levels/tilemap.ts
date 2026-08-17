import { TILE } from '../core/config';
import type { TileSet } from '../gfx/gen/tiles';
import type { Ctx2D } from '../gfx/renderer';

/**
 * Ground layer of a level.
 *
 * One `Uint16Array` of tile indices plus a parallel solidity cache: collision
 * queries are a couple of array lookups, which matters because every entity
 * asks the map several times per frame.
 */
export class TileMap {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: Uint16Array;
  readonly tileset: TileSet;
  private solidCache: Uint8Array;
  private time = 0;

  constructor(cols: number, rows: number, tileset: TileSet, fill = 0) {
    this.cols = cols;
    this.rows = rows;
    this.tileset = tileset;
    this.tiles = new Uint16Array(cols * rows).fill(fill);
    this.solidCache = new Uint8Array(cols * rows);
    this.rebuildSolidity();
  }

  get widthPx(): number {
    return this.cols * TILE;
  }

  get heightPx(): number {
    return this.rows * TILE;
  }

  index(col: number, row: number): number {
    return row * this.cols + col;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  get(col: number, row: number): number {
    if (!this.inBounds(col, row)) return -1;
    return this.tiles[this.index(col, row)];
  }

  set(col: number, row: number, tile: number): void {
    if (!this.inBounds(col, row)) return;
    const i = this.index(col, row);
    this.tiles[i] = tile;
    this.solidCache[i] = this.tileset.defs[tile]?.solid ? 1 : 0;
  }

  fillRect(col: number, row: number, w: number, h: number, tile: number): void {
    for (let y = row; y < row + h; y++) {
      for (let x = col; x < col + w; x++) this.set(x, y, tile);
    }
  }

  rebuildSolidity(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      this.solidCache[i] = this.tileset.defs[this.tiles[i]]?.solid ? 1 : 0;
    }
  }

  /** Solidity in world pixels. Out of bounds counts as solid. */
  solidAtPx(x: number, y: number): boolean {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (!this.inBounds(col, row)) return true;
    return this.solidCache[this.index(col, row)] === 1;
  }

  defAtPx(x: number, y: number) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (!this.inBounds(col, row)) return null;
    return this.tileset.defs[this.tiles[this.index(col, row)]] ?? null;
  }

  /** Axis-aligned box test against solid tiles. */
  boxCollides(x: number, y: number, w: number, h: number): boolean {
    const left = Math.floor((x - w / 2) / TILE);
    const right = Math.floor((x + w / 2 - 0.01) / TILE);
    const top = Math.floor((y - h) / TILE);
    const bottom = Math.floor((y - 0.01) / TILE);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!this.inBounds(col, row)) return true;
        if (this.solidCache[this.index(col, row)] === 1) return true;
      }
    }
    return false;
  }

  update(dt: number): void {
    this.time += dt;
  }

  /** Draws only the tiles visible in the camera rectangle. */
  draw(ctx: Ctx2D, camX: number, camY: number, viewW: number, viewH: number): void {
    const startCol = Math.max(0, Math.floor(camX / TILE));
    const endCol = Math.min(this.cols - 1, Math.floor((camX + viewW) / TILE));
    const startRow = Math.max(0, Math.floor(camY / TILE));
    const endRow = Math.min(this.rows - 1, Math.floor((camY + viewH) / TILE));
    const strip = this.tileset.strip;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const def = this.tileset.defs[this.tiles[this.index(col, row)]];
        if (!def) continue;
        const frame =
          def.frames.length === 1
            ? def.frames[0]
            : def.frames[Math.floor(this.time * def.fps) % def.frames.length];
        strip.draw(ctx, frame, col * TILE - camX, row * TILE - camY);
      }
    }
  }
}
