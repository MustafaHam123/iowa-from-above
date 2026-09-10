// ACES filmic tone mapping from three.js (MIT).
// Source: https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js
export const ACES_FILMIC_FRAGMENT_SHADER = `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float clarity;
  uniform float vibrance;
  uniform float splitTone;
  uniform float acesExposure;
  uniform float acesStrength;
  uniform float brightness;
  uniform float contrast;
  uniform float saturation;
  uniform float hue;
  uniform float warmth;
  uniform float shadows;
  uniform float highlights;
  uniform float fade;
  uniform float vignette;
  uniform float filterStrength;
  in vec2 v_textureCoordinates;

  vec3 RRTAndODTFit(vec3 value) {
    vec3 numerator = value * (value + 0.0245786) - 0.000090537;
    vec3 denominator = value * (0.983729 * value + 0.4329510) + 0.238081;
    return numerator / denominator;
  }

  vec3 ACESFilmicToneMapping(vec3 color) {
    const mat3 ACESInputMat = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777)
    );
    const mat3 ACESOutputMat = mat3(
      vec3(1.60475, -0.10208, -0.00327),
      vec3(-0.53108, 1.10813, -0.07276),
      vec3(-0.07367, -0.00605, 1.07602)
    );

    color *= acesExposure / 0.6;
    color = ACESInputMat * color;
    color = RRTAndODTFit(color);
    color = ACESOutputMat * color;
    return clamp(color, 0.0, 1.0);
  }

  vec3 hueRotate(vec3 color, float angle) {
    const vec3 k = vec3(0.57735026919);
    float cosAngle = cos(angle);
    return color * cosAngle + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - cosAngle);
  }

  void main(void) {
    vec4 source = texture(colorTexture, v_textureCoordinates);
    vec3 detail = source.rgb;
    // Bounded, four-neighbor sharpening shares the existing color pass.
    // Mobile sets clarity to zero and skips these texture reads entirely.
    if (clarity > 0.0) {
      vec2 texel = 1.0 / colorTextureDimensions;
      vec3 north = texture(colorTexture, clamp(v_textureCoordinates + vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).rgb;
      vec3 south = texture(colorTexture, clamp(v_textureCoordinates - vec2(0.0, texel.y), vec2(0.0), vec2(1.0))).rgb;
      vec3 east = texture(colorTexture, clamp(v_textureCoordinates + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).rgb;
      vec3 west = texture(colorTexture, clamp(v_textureCoordinates - vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))).rgb;
      vec3 localMin = min(source.rgb, min(min(north, south), min(east, west)));
      vec3 localMax = max(source.rgb, max(max(north, south), max(east, west)));
      vec3 highFrequency = source.rgb - (north + south + east + west) * 0.25;
      detail = clamp(source.rgb + highFrequency * clarity, localMin, localMax);
    }
    vec3 color = detail;
    // Cesium already tone maps HDR before custom stages. Avoid a second
    // filmic curve unless a preset explicitly asks for it.
    if (acesStrength > 0.0) {
      color = mix(detail, ACESFilmicToneMapping(detail), acesStrength);
    }
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float shadowMask = 1.0 - smoothstep(0.18, 0.62, luminance);
    float highlightMask = smoothstep(0.45, 0.92, luminance);
    vec3 graded = color;

    graded += brightness;
    graded = (graded - 0.5) * contrast + 0.5;
    graded = mix(vec3(dot(graded, vec3(0.299, 0.587, 0.114))), graded, saturation);
    graded = hueRotate(graded, hue);
    graded *= vec3(1.0 + warmth * 0.14, 1.0 + warmth * 0.035, 1.0 - warmth * 0.12);
    graded += shadowMask * shadows;
    graded += highlightMask * highlights;
    // Bring muted terrain colors forward while protecting saturated routes
    // and portals. Gentle split toning separates shade from sunlit surfaces.
    float chroma = max(graded.r, max(graded.g, graded.b)) - min(graded.r, min(graded.g, graded.b));
    float neutralMask = 1.0 - smoothstep(0.08, 0.5, chroma);
    float gray = dot(graded, vec3(0.2126, 0.7152, 0.0722));
    graded = mix(vec3(gray), graded, 1.0 + vibrance * neutralMask);
    graded += splitTone * (
      shadowMask * vec3(-0.018, 0.002, 0.024) +
      highlightMask * vec3(0.026, 0.009, -0.018)
    );
    graded = mix(graded, vec3(0.08, 0.10, 0.12), fade);

    vec2 centeredUv = v_textureCoordinates - 0.5;
    float vignetteMask = smoothstep(0.25, 0.78, dot(centeredUv, centeredUv) * 1.72);
    graded *= 1.0 - vignetteMask * vignette;
    graded = clamp(graded, 0.0, 1.0);

    out_FragColor = vec4(mix(color, graded, filterStrength), source.a);
  }
`;
