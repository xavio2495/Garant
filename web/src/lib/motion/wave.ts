// The pixel field's wave front runs from 300px before the edge to 400px past it, so a point at `coord`
// along an axis of length `size` is passed when the wave's progress reaches this value
export const wavePass = (coord: number, size: number) => Math.min(1, Math.max(0, (coord + 300) / (size + 700)));
