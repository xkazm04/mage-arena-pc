import { GlProgram, Mesh, MeshGeometry, Shader, Texture } from "pixi.js";
import { lightingDefaults, type PointLight } from "./lighting-math.ts";
export const maxLights = 4;
const vertex = `
in vec2 aPosition; in vec2 aUV;
out vec2 vUV; out vec2 vPos;
uniform mat3 uProjectionMatrix, uWorldTransformMatrix, uTransformMatrix;
uniform vec2 uSize;
void main() {
  vUV=aUV; vPos=aPosition*uSize;
  gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.)).xy,0.,1.);
}`;
/** The same lambert and squared falloff as `lightAmount` in lighting-math.ts; positions are in sprite pixels. */
export const litBodyFragment = `
in vec2 vUV; in vec2 vPos; out vec4 finalColor;
uniform sampler2D uPaint, uNormal;
uniform vec4 uFrame; // frame rect on the page, in page UV
uniform vec4 uLights[${maxLights}]; // x, y, z, radius
uniform vec4 uLightColors[${maxLights}];
uniform vec4 uAmbient; // ambient, tint strength, light count, unused
void main() {
  vec2 st=uFrame.xy+vUV*uFrame.zw;
  vec4 paint=texture(uPaint,st);
  if(paint.a<=0.) discard;
  vec3 n=normalize(texture(uNormal,st).rgb*2.-1.);
  float lit=uAmbient.x; vec3 tint=vec3(0.);
  for(int i=0;i<${maxLights};i++){
    if(float(i)>=uAmbient.z) break;
    vec3 d=vec3(uLights[i].xy-vPos, uLights[i].z);
    float dist=length(d);
    float lam=max(0.,dot(n,d/dist));
    float fall=max(0.,1.-dist/uLights[i].w);
    float amount=lam*fall*fall;
    lit+=amount;
    tint+=uLightColors[i].rgb*amount*uAmbient.y;
  }
  finalColor=vec4(paint.rgb*lit+tint*paint.a, paint.a);
}`;
/** A body quad drawn from one page frame with its normal map; the caller sets the matrix and calls `setLights`. */
export function litBodyMesh(
  color: Texture = Texture.WHITE,
  normal: Texture = Texture.WHITE,
) {
  const shader = new Shader({
    glProgram: GlProgram.from({
      name: "lit-body",
      vertex,
      fragment: litBodyFragment,
    }),
    resources: {
      uPaint: color.source,
      uNormal: normal.source,
      litUniforms: {
        uSize: { value: new Float32Array([1, 1]), type: "vec2<f32>" },
        uFrame: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
        uLights: {
          value: new Float32Array(maxLights * 4),
          type: "vec4<f32>",
          size: maxLights,
        },
        uLightColors: {
          value: new Float32Array(maxLights * 4),
          type: "vec4<f32>",
          size: maxLights,
        },
        uAmbient: {
          value: new Float32Array([
            lightingDefaults.ambient,
            lightingDefaults.tintStrength,
            0,
            0,
          ]),
          type: "vec4<f32>",
        },
      },
    },
  });
  // Pixi's mesh pipe owns a vec4 `uColor` in its local uniforms, so a sampler of that name made
  // every draw call glUniform4f on a sampler (GL_INVALID_OPERATION). The sampler is `uPaint`;
  // `resources.uColor` stays as an alias so callers keep their texture-swap spelling.
  const res = shader.resources;
  Object.defineProperty(res, "uColor", {
    configurable: true,
    get: () => res.uPaint,
    set: (v) => {
      res.uPaint = v;
    },
  });
  const geometry = new MeshGeometry({
    positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  return new Mesh({ geometry, shader });
}
/** Lights are in the body's own pixel space (origin at the quad's top-left, scaled by `size`). */
export function setLights(
  mesh: ReturnType<typeof litBodyMesh>,
  lights: PointLight[],
  size: [number, number],
) {
  const group = mesh.shader!.resources.litUniforms,
    u = group.uniforms,
    n = Math.min(maxLights, lights.length);
  u.uSize = new Float32Array(size);
  const pos = new Float32Array(maxLights * 4),
    col = new Float32Array(maxLights * 4);
  for (let i = 0; i < n; i++) {
    const l = lights[i]!,
      c = l.color ?? lightingDefaults.color;
    pos.set(
      [
        l.x,
        l.y,
        l.z ?? lightingDefaults.lightZ,
        l.radius ?? lightingDefaults.lightRadius,
      ],
      i * 4,
    );
    col.set([c[0], c[1], c[2], 1], i * 4);
  }
  u.uLights = pos;
  u.uLightColors = col;
  u.uAmbient = new Float32Array([
    lightingDefaults.ambient,
    lightingDefaults.tintStrength,
    n,
    0,
  ]);
  group.update();
}
