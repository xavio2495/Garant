// State shared between the pixel background and whatever drives it: the preloader's shockwave and the
// section waves that sweep across the pixels. Plain mutable fields, read once per frame by PixelField.
export const field = {
  // Before the shockwave the pixel space doesn't exist yet
  hidden: false,
  shock: { on: false, r: 0 },
  // A front travelling across the screen; p runs 0..1, mode picks the direction
  wave: { on: false, mode: "x" as "x" | "y", p: 0 },
};

// Where the wave's front is along its axis (px from the left edge, or up from the bottom) at progress p
export const waveFront = (p: number, size: number) => -300 + p * (size + 700);

// How far the front wanders at a point `v` px along the cross axis at time T (s); the field draws the aurora with
// this and the scene wipes follow the same edge, so the old content is cut exactly where the light arrives
export const waveWob = (v: number, T: number) =>
  110 * Math.sin(v * 0.0052 + T * 0.8) + 60 * Math.sin(v * 0.0143 - T * 1.3) + 150 * Math.sin(v * 0.0021 + T * 0.35 + 1.7);
