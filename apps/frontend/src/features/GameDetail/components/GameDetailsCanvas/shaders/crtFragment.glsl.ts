export const crtFragmentShader = /* glsl */ `
  uniform float u_time;
  uniform vec2  u_resolution;

  // ── CRT barrel distortion ─────────────────────────────────────────────
  // Bends the UV coordinates inward like a curved tube screen
  vec2 curveUV(vec2 uv) {
    uv = uv * 2.0 - 1.0;           // remap to -1..1
    vec2 offset = abs(uv.yx) / vec2(5.0, 4.0); // curvature strength per axis
    uv = uv + uv * offset * offset; // barrel bend
    uv = uv * 0.5 + 0.5;           // remap back to 0..1
    return uv;
  }

  // ── Vignette ──────────────────────────────────────────────────────────
  float vignette(vec2 uv) {
    vec2 d = uv - 0.5;
    return 1.0 - dot(d, d) * 3.5;  // stronger than before — more tube-like
  }

  // ── Noise for grain ───────────────────────────────────────────────────
  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // --- Apply CRT curvature
    vec2 crtUV = curveUV(uv);

    // --- Hard clip — outside the curved screen area is pure black
    // Creates the "screen inside a dark bezel" look
    if (crtUV.x < 0.0 || crtUV.x > 1.0 || crtUV.y < 0.0 || crtUV.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // --- Base background colour (matches #09090b)
    vec3 color = vec3(0.035, 0.035, 0.043);

    // --- Thick scanlines — lower frequency = thicker bands
    float scanFreq  = 180.0;         // was 400 — fewer lines = thicker
    float scanLine  = sin(crtUV.y * scanFreq * 3.14159 + u_time * 2.0);
    float scanDark  = smoothstep(-0.4, 0.4, scanLine); // hard edge = cartoonish
    color *= mix(0.35, 1.0, scanDark); // was 0.75 — much darker troughs

    // --- Slow drift on scanlines (phosphor persistence)
    float drift = sin(u_time * 0.4 + crtUV.y * 3.0) * 0.003;
    crtUV.x += drift;

    // --- CRT glow — subtle cyan center bloom
    float glowMask = clamp(vignette(crtUV), 0.0, 1.0);
    vec3 glowColor = vec3(0.0, 1.0, 1.0);
    color = mix(color, color + glowColor * 0.03, glowMask);

    // --- Vignette — dark edges, strong tube feel
    float vig = clamp(vignette(crtUV), 0.0, 1.0);
    color *= vig;

    // --- Phosphor flicker
    float flicker = 1.0 - 0.025 * sin(u_time * 8.7);
    color *= flicker;

    // --- Edge glow on scanline borders — thin bright line at each band top
    float edgeGlow = smoothstep(0.3, 0.5, scanLine) * 0.06;
    color += vec3(0.0, edgeGlow, edgeGlow); // cyan tint on bright edge

    // --- Film grain — subtle, tied to time
    float grain = rand(crtUV + fract(u_time)) * 0.025;
    color += grain;

    gl_FragColor = vec4(color, 0.92);
  }
`;
