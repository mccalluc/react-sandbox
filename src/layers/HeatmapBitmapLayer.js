/* eslint-disable */
import GL from '@luma.gl/constants';
import { _mergeShaders, project32, picking } from '@deck.gl/core';
import { BitmapLayer } from '@deck.gl/layers';
import { Texture2D } from '@luma.gl/core';
import { PIXELATED_TEXTURE_PARAMETERS } from './bitmap-utils';
import { vertexShader, fragmentShader } from './heatmap-bitmap-layer-shaders';

export const TILE_SIZE = 2048;
export const MIN_ROW_AGG = 1;
export const MAX_ROW_AGG = 16;

const defaultProps = {
  image: { type: 'object', value: null, async: true },
  colormap: { type: 'string', value: 'plasma', compare: true },
  bounds: { type: 'array', value: [1, 0, 0, 1], compare: true },
  aggSizeX: { type: 'number', value: 8.0, compare: true },
  aggSizeY: { type: 'number', value: 8.0, compare: true },
  colorScaleLo: { type: 'number', value: 0.0, compare: true },
  colorScaleHi: { type: 'number', value: 1.0, compare: true },
};

/**
 * A BitmapLayer that performs aggregation in the fragment shader,
 * and renders its texture from a Uint8Array rather than an ImageData.
 */
export default class HeatmapBitmapLayer extends BitmapLayer {
  
  /**
   * Copy of getShaders from Layer (grandparent, parent of BitmapLayer).
   * Reference: https://github.com/visgl/deck.gl/blob/0afd4e99a6199aeec979989e0c361c97e6c17a16/modules/core/src/lib/layer.js#L302
   * @param {object} shaders
   * @returns {object} Merged shaders.
   */
  _getShaders(shaders) {
    for (const extension of this.props.extensions) {
      shaders = _mergeShaders(shaders, extension.getShaders.call(this, extension));
    }
    return shaders;
  }

  /**
   * Need to override to provide custom shaders.
   */
  getShaders() {
    const { colormap } = this.props;
    return this._getShaders({
      vs: vertexShader,
      fs: fragmentShader.replace('__colormap', colormap),
      modules: [ project32, picking ]
    });
  }

  /**
   * Need to override to provide additional uniform values.
   * Simplified by removing video-related code.
   * Reference: https://github.com/visgl/deck.gl/blob/0afd4e99a6199aeec979989e0c361c97e6c17a16/modules/layers/src/bitmap-layer/bitmap-layer.js#L173
   * @param {*} opts 
   */
  draw(opts) {
    const { uniforms } = opts;
    const { bitmapTexture, model } = this.state;
    const {
      aggSizeX,
      aggSizeY,
      colorScaleLo,
      colorScaleHi,
    } = this.props;

    // Render the image
    if (bitmapTexture && model) {
      model
        .setUniforms(
          Object.assign({}, uniforms, {
            uBitmapTexture: bitmapTexture,
            uTextureSize: [TILE_SIZE, TILE_SIZE],
            uAggSize: [aggSizeX, aggSizeY],
            uColorScaleRange: [colorScaleLo, colorScaleHi],
          })
        )
        .draw();
    }
  }
  
  /**
   * Need to override to provide the custom DEFAULT_TEXTURE_PARAMETERS
   * object.
   * Simplified by removing video-related code.
   * Reference: https://github.com/visgl/deck.gl/blob/0afd4e99a6199aeec979989e0c361c97e6c17a16/modules/layers/src/bitmap-layer/bitmap-layer.js#L218
   * @param {Uint8Array} image
   */
  loadTexture(image) {
    const { gl } = this.context;
    
    if(this.state.bitmapTexture) {
      this.state.bitmapTexture.delete();
    }
    
    if(image instanceof Texture2D) {
      this.setState({
        bitmapTexture: image,
      });
    } else if(image) {
      this.setState({
        bitmapTexture: new Texture2D(gl, {
          data: image,
          mipmaps: false,
          parameters: PIXELATED_TEXTURE_PARAMETERS,
          // Each color contains a single luminance value.
          // When sampled, rgb are all set to this luminance, alpha is 1.0.
          // Reference: https://luma.gl/docs/api-reference/webgl/texture#texture-formats
          format: GL.LUMINANCE,
          dataFormat: GL.LUMINANCE,
          type: GL.UNSIGNED_BYTE,
          width: TILE_SIZE,
          height: TILE_SIZE,
        }),
      });
    }
  }
}
HeatmapBitmapLayer.layerName = 'HeatmapBitmapLayer';
HeatmapBitmapLayer.defaultProps = defaultProps;