const SOFTWARE_RENDERER_RE = /swiftshader|llvmpipe|softpipe|software|basic renderer/i;

let cached: boolean | null = null;

function detectSoftwareRenderer(): boolean {
  if (typeof document === 'undefined') return false;

  const probe = document.createElement('canvas');
  const names: string[] = ['webgl2', 'webgl', 'experimental-webgl'];

  let context: WebGLRenderingContext | null = null;
  for (const name of names) {
    context = probe.getContext(name) as WebGLRenderingContext | null;
    if (context) break;
  }

  if (!context) return true;

  const info = context.getExtension('WEBGL_debug_renderer_info');
  if (info && typeof info.UNMASKED_RENDERER_WEBGL === 'number') {
    const renderer = String(context.getParameter(info.UNMASKED_RENDERER_WEBGL));
    if (SOFTWARE_RENDERER_RE.test(renderer)) return true;
  }

  const caveatProbe = document.createElement('canvas');
  const caveatContext = (caveatProbe.getContext('webgl', {
    failIfMajorPerformanceCaveat: true,
  }) ?? caveatProbe.getContext('webgl2', {
    failIfMajorPerformanceCaveat: true,
  })) as WebGLRenderingContext | null;

  return caveatContext === null;
}

export function isSoftwareRenderer(): boolean {
  cached ??= detectSoftwareRenderer();
  return cached;
}

export default isSoftwareRenderer;