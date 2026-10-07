import { GlProgram, Mesh, MeshGeometry, Shader, Texture } from "pixi.js";
const vertex = `
in vec2 aPosition; in vec2 aUV;
out vec2 vUV; out vec4 vColor;
uniform mat3 uProjectionMatrix, uWorldTransformMatrix, uTransformMatrix;
uniform vec4 uWorldColorAlpha, uColor;
void main() {
  vUV=aUV; vColor=uColor*uWorldColorAlpha;
  gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.)).xy,0.,1.);
}`;
const fragment = `
in vec2 vUV; in vec4 vColor; out vec4 finalColor;
uniform sampler2D uPaint, uRank;
uniform vec4 uFrame, uNext;
uniform vec4 uParams; // progress, base opacity, inverse cone angle factor, ward half-angle
uniform vec2 uBlend; // frame interpolation, apply rank
uniform float uLaneRepeat;
void main() {
  vec2 uv=vUV;
  if(uParams.z>0.) {
    vec2 d=uv-vec2(1./3.,.5); float a=atan(d.y,d.x)*uParams.z;
    if(abs(a)>1.57079633) discard;
    uv=vec2(1./3.,.5)+length(d)*vec2(cos(a),sin(a));
  }
  if(any(lessThan(uv,vec2(0.))) || any(greaterThan(uv,vec2(1.)))) discard;
  if(uParams.w>0. && abs(atan(uv.y-.5,uv.x-.5))>uParams.w) discard;
  vec2 paintUV=uv;
  // Preserve endcaps; repeat the delivered middle rails/glyphs on extreme lanes.
  if(uLaneRepeat>1. && uv.x>.25 && uv.x<.75)paintUV.x=.25+fract((uv.x-.25)*2.*uLaneRepeat)*.5;
  vec4 paint=mix(texture(uPaint,uFrame.xy+paintUV*uFrame.zw),texture(uPaint,uNext.xy+paintUV*uNext.zw),uBlend.x);
  float rank=texture(uRank,uv).r;
  float fill=uParams.x<=0.?0.:uParams.x>=1.?1.:clamp((uParams.x-rank)*255.+1.,0.,1.);
  float opacity=mix(1.,uParams.y+(1.-uParams.y)*fill,uBlend.y);
  finalColor=paint*opacity*vColor;
}`;
export function sigilMesh() {
  const shader = new Shader({
    glProgram: GlProgram.from({ name: "painted-sigil", vertex, fragment }),
    resources: {
      uPaint: Texture.WHITE.source,
      uRank: Texture.WHITE.source,
      sigilUniforms: {
        uFrame: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
        uNext: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
        uParams: { value: new Float32Array([1, 1, 0, 0]), type: "vec4<f32>" },
        uBlend: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
        uLaneRepeat: { value: 1, type: "f32" },
      },
    },
  });
  const geometry = new MeshGeometry({
    positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  return new Mesh({ geometry, shader });
}
