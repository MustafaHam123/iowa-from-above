export const DEPTH_DISTANCE_BLUR_FRAGMENT_SHADER = `
  uniform sampler2D colorTexture;
  uniform sampler2D depthTexture;
  uniform vec2 viewportSize;
  uniform float blurStartMeters;
  uniform float blurEndMeters;
  uniform float maxRadiusPixels;
  uniform float blurStrength;
  in vec2 v_textureCoordinates;

  float sceneDistanceMeters(vec2 uv) {
    float depth = czm_readDepth(depthTexture, uv);

    if (depth >= 1.0) {
      return 0.0;
    }

    vec2 xy = vec2((uv.x * 2.0 - 1.0), ((1.0 - uv.y) * 2.0 - 1.0));
    vec4 positionEC = czm_inverseProjection * vec4(xy, depth, 1.0);
    positionEC /= positionEC.w;

    return max(-positionEC.z, 0.0);
  }

  vec4 depthAwareBlur(vec2 uv, float radiusPixels) {
    vec2 texel = radiusPixels / viewportSize;
    vec4 color = texture(colorTexture, uv) * 0.36;

    color += texture(colorTexture, uv + texel) * 0.16;
    color += texture(colorTexture, uv - texel) * 0.16;
    color += texture(colorTexture, uv + vec2(texel.x, -texel.y)) * 0.16;
    color += texture(colorTexture, uv + vec2(-texel.x, texel.y)) * 0.16;

    return color;
  }

  void main(void) {
    vec4 source = texture(colorTexture, v_textureCoordinates);
    float distanceMeters = sceneDistanceMeters(v_textureCoordinates);
    float farAmount = smoothstep(blurStartMeters, blurEndMeters, distanceMeters);

    if (farAmount <= 0.001) {
      out_FragColor = source;
      return;
    }

    float radiusPixels = maxRadiusPixels * farAmount;
    vec4 blurred = depthAwareBlur(v_textureCoordinates, radiusPixels);

    out_FragColor = mix(source, blurred, farAmount * blurStrength);
  }
`;
