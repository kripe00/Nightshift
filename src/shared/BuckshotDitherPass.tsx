import { useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uDitherPixelSize;
  uniform float uDitherStrength;
  uniform float uColorLevels;
  uniform float uScanlineOpacity;
  uniform float uTime;

  varying vec2 vUv;

  // WebGL1 & WebGL2 100% compatible 4x4 Ordered Bayer matrix lookup
  float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));

    vec4 row;
    if (y == 0) {
      row = vec4(0.0, 8.0, 2.0, 10.0);
    } else if (y == 1) {
      row = vec4(12.0, 4.0, 14.0, 6.0);
    } else if (y == 2) {
      row = vec4(3.0, 11.0, 1.0, 9.0);
    } else {
      row = vec4(15.0, 7.0, 13.0, 5.0);
    }

    float val;
    if (x == 0) {
      val = row.x;
    } else if (x == 1) {
      val = row.y;
    } else if (x == 2) {
      val = row.z;
    } else {
      val = row.w;
    }

    return (val / 16.0) - 0.5;
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 acesFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float linearizeDepth(float depth) {
    float z = depth * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) /
      max(0.0001, (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear)));
  }

  void main() {
    // Sample scene at full 1:1 native resolution so all text & micro-print stay razor-sharp
    vec4 rawTexel = texture2D(tDiffuse, vUv);
    vec3 col = acesFilm(rawTexel.rgb * 1.18);
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    float isPaper = smoothstep(0.54, 0.71, luma);
    float isBrightCRT = smoothstep(0.50, 0.74, max(col.g, col.r));
    float protectText = clamp(max(isPaper, isBrightCRT), 0.0, 1.0);

    // 1. Chiaroscuro Split-Tone Grading:
    // Cold Chernobyl-teal/black in deep shadows vs. warm tungsten-amber in lit areas
    vec3 chernobylShadow = vec3(0.018, 0.042, 0.038);
    vec3 warmAmberHighlight = vec3(1.10, 1.02, 0.88);
    float shadowWeight = (1.0 - smoothstep(0.02, 0.34, luma)) * (1.0 - protectText);
    float highlightWeight = smoothstep(0.26, 0.82, luma) * (1.0 - protectText);

    col = mix(col, mix(chernobylShadow, col * 1.06, 0.72), shadowWeight * 0.55);
    col *= mix(vec3(1.0), warmAmberHighlight, highlightWeight * 0.38);

    // 2. Exponential Distance Fog in Deep Bunker Corners (using scene depth buffer)
    float rawDepth = texture2D(tDepth, vUv).r;
    float viewDist = linearizeDepth(rawDepth);
    float fogFactor = (1.0 - exp(-pow(max(0.0, viewDist - 2.1) * 0.19, 1.85))) * (1.0 - protectText);
    vec3 deepBunkerFog = vec3(0.022, 0.038, 0.033);
    col = mix(col, deepBunkerFog, clamp(fogFactor, 0.0, 0.78));

    // Coarse 2.5px Bayer grid (clearly visible Buckshot Roulette cross-hatched stippling!)
    vec2 bayerCell = floor(gl_FragCoord.xy / uDitherPixelSize);
    float b = bayer4x4(bayerCell);

    // Subtle analog film grain in shadows
    float grain =
      (hash12(bayerCell + fract(uTime * 11.7) * 97.0) - 0.5) *
      0.022 *
      (1.0 - luma * 0.7) *
      (1.0 - protectText);
    col = clamp(col + vec3(grain), 0.0, 1.0);

    // Strong dithering (0.14) and 7 color levels across the entire room/desk,
    // softening to 24 levels (0.025 strength) strictly on bright paper sheets and glowing CRT text
    float activeStrength = mix(uDitherStrength, 0.025, protectText);
    float activeLevels = mix(uColorLevels, 24.0, protectText);

    vec3 dithered = clamp(col + b * activeStrength, 0.0, 1.0);
    vec3 quantized = floor(dithered * activeLevels + 0.5) / activeLevels;

    // Subtle horizontal CRT scanlines
    float scanline =
      sin(gl_FragCoord.y * 3.14159) *
      uScanlineOpacity *
      (1.0 - protectText * 0.65);
    quantized = clamp(quantized - vec3(scanline * 0.5), 0.0, 1.0);

    // Heavy industrial chiaroscuro vignette around the screen borders
    vec2 centeredUv = vUv * 2.0 - 1.0;
    float vigDist = dot(centeredUv * vec2(0.94, 1.06), centeredUv * vec2(0.94, 1.06));
    float vignette = smoothstep(1.66, 0.28, vigDist);
    vec3 finalColor = mix(vec3(0.012, 0.022, 0.019), quantized, mix(0.62, 1.0, vignette));

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
  }
`

export const BuckshotDitherPass: React.FC = () => {
  const { gl, scene, camera, size } = useThree()

  const renderTarget = useMemo(() => {
    const depthTex = new THREE.DepthTexture(
      Math.max(1, size.width),
      Math.max(1, size.height)
    )
    depthTex.minFilter = THREE.NearestFilter
    depthTex.magFilter = THREE.NearestFilter

    const target = new THREE.WebGLRenderTarget(
      Math.max(1, size.width),
      Math.max(1, size.height),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType,
        depthBuffer: true,
        depthTexture: depthTex,
        stencilBuffer: false,
      }
    )
    target.texture.generateMipmaps = false
    return target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const dpr = gl.getPixelRatio()
    renderTarget.setSize(
      Math.max(1, Math.floor(size.width * dpr)),
      Math.max(1, Math.floor(size.height * dpr))
    )
  }, [gl, renderTarget, size.width, size.height])

  useEffect(() => {
    return () => {
      renderTarget.depthTexture?.dispose()
      renderTarget.dispose()
    }
  }, [renderTarget])

  const { postScene, postCamera, postMaterial } = useMemo(() => {
    const pScene = new THREE.Scene()
    const pCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        tDepth: { value: renderTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 25.0 },
        uDitherPixelSize: { value: 2.5 },
        uDitherStrength: { value: 0.14 },
        uColorLevels: { value: 7.0 },
        uScanlineOpacity: { value: 0.035 },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    pScene.add(quad)
    return { postScene: pScene, postCamera: pCamera, postMaterial: mat }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTarget])

  useEffect(() => {
    return () => {
      postMaterial.dispose()
    }
  }, [postMaterial])

  // Priority 1 takes over R3F's default render loop so we render Scene -> RenderTarget -> Fullscreen Bayer Dither Quad
  useFrame((state) => {
    const uniforms = postMaterial.uniforms
    uniforms.uDitherPixelSize.value = 2.5
    uniforms.uDitherStrength.value = 0.14
    uniforms.uColorLevels.value = 7.0
    uniforms.uScanlineOpacity.value = 0.035
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uResolution.value.set(
      renderTarget.width,
      renderTarget.height
    )
    uniforms.tDiffuse.value = renderTarget.texture
    uniforms.tDepth.value = renderTarget.depthTexture
    if (camera instanceof THREE.PerspectiveCamera) {
      uniforms.uCameraNear.value = camera.near
      uniforms.uCameraFar.value = camera.far
    }

    const prevRenderTarget = gl.getRenderTarget()
    gl.setRenderTarget(renderTarget)
    gl.clear()
    gl.render(scene, camera)

    gl.setRenderTarget(prevRenderTarget)
    gl.render(postScene, postCamera)
  }, 1)

  return null
}
