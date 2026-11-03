// CSS matrix3d that maps a w x h box onto four points (top-left, top-right, bottom-right, bottom-left) in pixels.
// Used to fit the menu exactly onto the monitor's screen as the camera sees it.
type Pt = [number, number]

function solve(a: number[][], b: number[]): number[] {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    const p = m[col][col] || 1e-12
    for (let c = col; c <= n; c++) m[col][c] /= p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col]
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c]
    }
  }
  return m.map((row) => row[n])
}

export function warpMatrix(w: number, h: number, quad: Pt[]): string {
  const src: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]]
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [X, Y] = quad[i]
    a.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    a.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }
  const [h0, h1, h2, h3, h4, h5, h6, h7] = solve(a, b)
  // Column-major: x' = h0 x + h1 y + h2, y' = h3 x + h4 y + h5, w' = h6 x + h7 y + 1
  const m = [h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1]
  return `matrix3d(${m.map((v) => v.toFixed(10)).join(',')})`
}
