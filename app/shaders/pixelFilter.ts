export const PIXEL_FILTER_FRAGMENT_SHADER = `
  uniform sampler2D colorTexture;
  uniform vec2 viewportSize;
  uniform float pixelSize;
  uniform float pixelStrength;
  in vec2 v_textureCoordinates;

  void main(void) {
    vec2 blockSize = max(vec2(pixelSize) / viewportSize, vec2(0.00001));
    vec2 pixelatedUv = (floor(v_textureCoordinates / blockSize) + 0.5) * blockSize;
    vec4 source = texture(colorTexture, v_textureCoordinates);
    vec4 pixelated = texture(colorTexture, clamp(pixelatedUv, vec2(0.0), vec2(1.0)));

    out_FragColor = mix(source, pixelated, pixelStrength);
  }
`;
