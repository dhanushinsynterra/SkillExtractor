export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function pcm16Base64ToFloat(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64)
  const count = Math.floor(binary.length / 2)
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let v = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    if (v >= 0x8000) v -= 0x10000
    out[i] = v / 0x8000
  }
  return out
}
