import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import {
  aabbIntersectsSlice,
  hypercubeEdges,
  hypercubeVertices,
  sliceHypercubeTo3D,
} from "../math/geometry5";
import { Vec5 } from "../math/vec5";
import { projectRelative, sliceWeight, type ProjectionSettings } from "../projection/engine";
import { ballSliceRadius, isBall } from "../sim/physics";
import type { PlayerState, WorldObject } from "../sim/types";
import type { World } from "../sim/world";

interface ObjView {
  group: THREE.Group;
  solid: THREE.Mesh;
  wire: THREE.LineSegments;
  torus?: THREE.Mesh;
  sliceKey?: string;
}

const _rel = new Vec5();

function projected(p: Vec5, observer: Vec5, settings: ProjectionSettings) {
  return projectRelative(_rel.copy(p).sub(observer), settings);
}

function setLinePositions(line: THREE.LineSegments, positions: number[]): void {
  const geo = line.geometry;
  const attr = geo.getAttribute("position");
  if (!attr || attr.count < positions.length / 3) {
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  } else {
    const arr = attr.array as Float32Array;
    arr.fill(0);
    arr.set(positions);
    attr.needsUpdate = true;
    geo.setDrawRange(0, positions.length / 3);
  }
}

function hypercubeWire(
  dimensions: 4 | 5,
  obj: WorldObject,
  observer: Vec5,
  settings: ProjectionSettings,
): number[] {
  const half = obj.size.x;
  const verts = hypercubeVertices(dimensions, half).map((p) => {
    const t = obj.rotation.multiplyVec(p);
    t.add(obj.pos);
    return t;
  });
  const edges = hypercubeEdges(dimensions);
  const pos: number[] = [];
  for (const [i, j] of edges) {
    const a = verts[i];
    const b = verts[j];
    if (!a || !b) continue;
    const pa = projected(a, observer, settings);
    const pb = projected(b, observer, settings);
    if (!pa.visible && !pb.visible) continue;
    pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  }
  return pos;
}

function aabbWire(obj: WorldObject, observer: Vec5, settings: ProjectionSettings): number[] {
  const verts = hypercubeVertices(5, 1).map((u) =>
    new Vec5(
      obj.pos.x + u.x * obj.size.x,
      obj.pos.y + u.y * obj.size.y,
      obj.pos.z + u.z * obj.size.z,
      obj.pos.w + u.w * obj.size.w,
      obj.pos.v + u.v * obj.size.v,
    ),
  );
  const pos: number[] = [];
  for (const [i, j] of hypercubeEdges(5)) {
    const a = verts[i];
    const b = verts[j];
    if (!a || !b) continue;
    const pa = projected(a, observer, settings);
    const pb = projected(b, observer, settings);
    pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  }
  return pos;
}

function makeSolidMat(obj: WorldObject): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: obj.color,
    emissive: obj.emissive,
    roughness: 0.42,
    metalness: 0.18,
    transparent: true,
    opacity: obj.opacity,
    side: THREE.DoubleSide,
  });
}

export class LabRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.08, 220);
  readonly axes = new THREE.Group();
  showAxes = false;
  private views = new Map<string, ObjView>();
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private sphereGeo = new THREE.SphereGeometry(1, 28, 20);
  private torusGeo = new THREE.TorusGeometry(1.15, 0.08, 10, 48);
  private particleGeo = new THREE.BufferGeometry();
  private particlePts: THREE.Points;
  private gridGroup = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private pick = new THREE.Raycaster();
  private ndc = new THREE.Vector2(0, 0);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b1018, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog(0x0b1018, 22, 85);
    this.camera.rotation.order = "YXZ";

    this.hemi = new THREE.HemisphereLight(0xc5e4f4, 0x1a222c, 0.9);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0x4a5a68, 0.85));
    const key = new THREE.DirectionalLight(0xf2fbff, 1.15);
    key.position.set(4, 10, 6);
    this.scene.add(key);
    const fill = new THREE.PointLight(0xc44cff, 0.55, 40);
    fill.position.set(-3, 2, 2);
    this.scene.add(fill);
    const fill2 = new THREE.PointLight(0xffc857, 0.35, 40);
    fill2.position.set(3, 1, -2);
    this.scene.add(fill2);

    this.particleGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(220 * 3), 3));
    this.particleGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(220 * 3), 3));
    this.particlePts = new THREE.Points(
      this.particleGeo,
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(this.particlePts);

    this.buildAxes();
    this.buildGrid();
    this.scene.add(this.axes);
    this.scene.add(this.gridGroup);
    this.axes.visible = false;
  }

  private buildAxes(): void {
    const make = (dir: THREE.Vector3, color: number, len: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), dir.clone().multiplyScalar(len)]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
    };
    this.axes.add(make(new THREE.Vector3(1, 0, 0), 0xff5a5a, 2.2));
    this.axes.add(make(new THREE.Vector3(0, 1, 0), 0x5aff8a, 2.2));
    this.axes.add(make(new THREE.Vector3(0, 0, 1), 0x5aa8ff, 2.2));
    this.axes.add(make(new THREE.Vector3(0.7, 0.2, 0.5).normalize(), 0xe060ff, 2.2));
    this.axes.add(make(new THREE.Vector3(-0.4, 0.3, 0.8).normalize(), 0xffc857, 2.2));
  }

  private buildGrid(): void {
    const draw = (w: number, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      const span = 24;
      const step = 2;
      for (let i = -span; i <= span; i += step) {
        pts.push(new THREE.Vector3(-span, 0, i), new THREE.Vector3(span, 0, i));
        pts.push(new THREE.Vector3(i, 0, -span), new THREE.Vector3(i, 0, span));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      );
      line.userData.w = w;
      this.gridGroup.add(line);
    };
    draw(0, 0x1a3344, 0.35);
    draw(-2.4, 0x4a2060, 0.12);
    draw(2.4, 0x4a2060, 0.12);
    draw(-4.8, 0x4a2060, 0.06);
    draw(4.8, 0x4a2060, 0.06);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  clear(): void {
    for (const v of this.views.values()) {
      this.scene.remove(v.group);
      v.solid.geometry.dispose();
    }
    this.views.clear();
  }

  pickId(): string | null {
    this.pick.setFromCamera(this.ndc, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const v of this.views.values()) meshes.push(v.solid);
    const hits = this.pick.intersectObjects(meshes, false);
    const id = hits[0]?.object.userData.id;
    return typeof id === "string" ? id : null;
  }

  sync(
    world: World,
    player: PlayerState,
    settings: ProjectionSettings,
    selectedId: string | null,
  ): void {
    this.camera.rotation.y = -player.yaw;
    this.camera.rotation.x = player.pitch;
    this.camera.position.set(0, 0, 0);

    const fog = this.scene.fog as THREE.Fog;
    const mag = Math.min(1, Math.abs(player.pos.w) / 8);
    const amb = Math.min(1, Math.abs(player.pos.v) / 8);
    fog.color.setRGB(0.05 + mag * 0.16, 0.07, 0.1 + amb * 0.1);
    this.renderer.setClearColor(fog.color, 1);

    this.axes.visible = this.showAxes;
    this.gridGroup.visible = world.objects.some((o) => o.kind === "grid");
    for (const child of this.gridGroup.children) {
      const line = child as THREE.LineSegments;
      const w = Number(line.userData.w);
      const mat = line.material as THREE.LineBasicMaterial;
      const dw = Math.abs(w - 0);
      mat.opacity = 0.08 + 0.28 * Math.exp(-Math.abs(player.pos.w - w) * 0.7);
      void dw;
      line.position.y = -player.pos.y;
    }

    const seen = new Set<string>();
    for (const obj of world.objects) {
      if (obj.kind === "grid") continue;
      seen.add(obj.id);
      let view = this.views.get(obj.id);
      if (!view) {
        view = this.createView(obj);
        this.views.set(obj.id, view);
        this.scene.add(view.group);
      }
      this.updateView(view, obj, player, settings, selectedId === obj.id);
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        this.scene.remove(view.group);
        this.views.delete(id);
      }
    }

    this.syncParticles(world, player, settings);
  }

  private createView(obj: WorldObject): ObjView {
    const group = new THREE.Group();
    const solid = new THREE.Mesh(isBall(obj.kind) || obj.kind === "gravity-source" || obj.kind === "portal" ? this.sphereGeo : this.boxGeo, makeSolidMat(obj));
    solid.userData.id = obj.id;
    solid.castShadow = false;
    const wireMat = new THREE.LineBasicMaterial({ color: obj.color, transparent: true, opacity: 0.55 });
    const wire = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
    group.add(solid);
    group.add(wire);
    let torus: THREE.Mesh | undefined;
    if (obj.kind === "portal") {
      torus = new THREE.Mesh(
        this.torusGeo,
        new THREE.MeshStandardMaterial({
          color: obj.color,
          emissive: obj.color,
          emissiveIntensity: 0.8,
          roughness: 0.3,
          metalness: 0.4,
        }),
      );
      group.add(torus);
    }
    return { group, solid, wire, torus };
  }

  private updateView(
    view: ObjView,
    obj: WorldObject,
    player: PlayerState,
    settings: ProjectionSettings,
    selected: boolean,
  ): void {
    const pr = projected(obj.pos, player.pos, settings);
    const mat = view.solid.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = selected ? 0.9 : 0.25;
    const weight = sliceWeight(pr.dw, pr.dv, settings);
    mat.opacity = obj.opacity * Math.max(0.05, weight);

    if (obj.kind === "penteract" || obj.kind === "hypercube") {
      const dim: 4 | 5 = obj.kind === "penteract" ? 5 : 4;
      setLinePositions(view.wire, hypercubeWire(dim, obj, player.pos, settings));
      view.wire.visible = settings.mode !== "slice";
      const sliceKey = `${dim}:${player.pos.w.toFixed(2)}:${player.pos.v.toFixed(2)}:${obj.rotation.e[0]!.toFixed(3)}:${obj.rotation.e[15]!.toFixed(3)}:${obj.pos.x.toFixed(2)}`;
      if (
        (settings.mode === "slice" || settings.mode === "combined") &&
        view.sliceKey !== sliceKey
      ) {
        view.sliceKey = sliceKey;
        const slice = sliceHypercubeTo3D(dim, obj.size.x, obj.rotation, obj.pos, player.pos.w, player.pos.v);
        if (slice.points.length >= 4) {
          try {
            const v3 = slice.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
            const geo = new ConvexGeometry(v3);
            if (view.solid.geometry !== this.boxGeo && view.solid.geometry !== this.sphereGeo) {
              view.solid.geometry.dispose();
            }
            view.solid.geometry = geo;
            view.solid.visible = true;
            mat.opacity = obj.opacity * 0.45;
          } catch {
            view.solid.visible = false;
          }
        } else {
          view.solid.visible = false;
        }
      } else if (settings.mode !== "slice" && settings.mode !== "combined") {
        view.solid.visible = false;
      }
      view.solid.position.set(-player.pos.x, -player.pos.y, -player.pos.z);
      view.solid.scale.set(1, 1, 1);
      view.group.position.set(0, 0, 0);
      return;
    }

    if (obj.kind === "portal") {
      view.solid.visible = false;
      view.wire.visible = false;
      if (view.torus) {
        view.torus.visible = pr.visible;
        view.torus.position.set(pr.x, pr.y, pr.z);
        view.torus.rotation.x += 0.01;
        view.torus.rotation.y += 0.02;
        const s = Math.max(0.35, Math.abs(pr.scale));
        view.torus.scale.setScalar(s);
      }
      return;
    }

    if (isBall(obj.kind) || obj.kind === "gravity-source") {
      let radius = obj.size.x * Math.abs(pr.scale);
      if (settings.mode === "slice" || settings.mode === "combined") {
        const sliced = ballSliceRadius(obj, player.pos);
        if (settings.mode === "slice") radius = sliced;
        else radius = sliced > 0 ? sliced : obj.size.x * 0.15 * Math.abs(pr.scale);
        view.solid.visible = settings.mode === "combined" || sliced > 0.02;
      } else {
        view.solid.visible = pr.visible;
      }
      view.solid.position.set(pr.x, pr.y, pr.z);
      view.solid.scale.setScalar(Math.max(radius, 0.001));
      if (view.solid.geometry !== this.sphereGeo) {
        view.solid.geometry.dispose();
        view.solid.geometry = this.sphereGeo;
      }
      setLinePositions(view.wire, []);
      view.wire.visible = false;
      return;
    }

    const min = new Vec5(obj.pos.x - obj.size.x, obj.pos.y - obj.size.y, obj.pos.z - obj.size.z, obj.pos.w - obj.size.w, obj.pos.v - obj.size.v);
    const max = new Vec5(obj.pos.x + obj.size.x, obj.pos.y + obj.size.y, obj.pos.z + obj.size.z, obj.pos.w + obj.size.w, obj.pos.v + obj.size.v);
    const hit = aabbIntersectsSlice(min, max, player.pos.w, player.pos.v, settings.thicknessW, settings.thicknessV);
    setLinePositions(view.wire, aabbWire(obj, player.pos, settings));
    view.wire.visible = settings.mode !== "slice";
    (view.wire.material as THREE.LineBasicMaterial).opacity = settings.mode === "combined" ? 0.22 : 0.5;

    if (view.solid.geometry !== this.boxGeo) {
      view.solid.geometry.dispose();
      view.solid.geometry = this.boxGeo;
    }

    if (settings.mode === "slice") {
      view.solid.visible = hit;
      view.solid.position.set(obj.pos.x - player.pos.x, obj.pos.y - player.pos.y, obj.pos.z - player.pos.z);
      view.solid.scale.set(obj.size.x * 2, obj.size.y * 2, obj.size.z * 2);
    } else {
      view.solid.visible = hit;
      view.solid.position.set(obj.pos.x - player.pos.x, obj.pos.y - player.pos.y, obj.pos.z - player.pos.z);
      view.solid.scale.set(obj.size.x * 2, obj.size.y * 2, obj.size.z * 2);
      if (!hit && settings.mode === "combined") {
        view.solid.visible = true;
        view.solid.position.set(pr.x, pr.y, pr.z);
        const s = Math.max(0.15, Math.abs(pr.scale) * 0.35);
        view.solid.scale.set(obj.size.x * 2 * s, obj.size.y * 2 * s, obj.size.z * 2 * s);
        mat.opacity *= 0.18;
      } else if (!hit && settings.mode === "perspective") {
        view.solid.visible = true;
        view.solid.position.set(pr.x, pr.y, pr.z);
        const s = Math.abs(pr.scale);
        view.solid.scale.set(obj.size.x * 2 * s, obj.size.y * 2 * s, obj.size.z * 2 * s);
        mat.opacity *= 0.2;
      }
    }
  }

  private syncParticles(world: World, player: PlayerState, settings: ProjectionSettings): void {
    const pos = this.particleGeo.getAttribute("position") as THREE.BufferAttribute;
    const col = this.particleGeo.getAttribute("color") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const carr = col.array as Float32Array;
    arr.fill(0);
    carr.fill(0);
    let n = 0;
    const color = new THREE.Color();
    for (const p of world.particles) {
      if (n >= 220) break;
      const pr = projected(p.pos, player.pos, settings);
      arr[n * 3] = pr.x;
      arr[n * 3 + 1] = pr.y;
      arr[n * 3 + 2] = pr.z;
      color.setHSL(p.hue, 0.85, 0.6);
      carr[n * 3] = color.r;
      carr[n * 3 + 1] = color.g;
      carr[n * 3 + 2] = color.b;
      n += 1;
    }
    for (const obj of world.objects) {
      if (obj.kind !== "portal" || n >= 220) continue;
      for (let i = 0; i < 8 && n < 220; i++) {
        const a = world.time * 2 + i;
        const q = new Vec5(
          obj.pos.x + Math.cos(a) * 1.1,
          obj.pos.y + Math.sin(a * 1.3) * 0.4,
          obj.pos.z + Math.sin(a) * 1.1,
          obj.pos.w + Math.cos(a * 0.7) * 0.8,
          obj.pos.v + Math.sin(a * 0.5) * 0.8,
        );
        const pr = projected(q, player.pos, settings);
        arr[n * 3] = pr.x;
        arr[n * 3 + 1] = pr.y;
        arr[n * 3 + 2] = pr.z;
        color.set(obj.color);
        carr[n * 3] = color.r;
        carr[n * 3 + 1] = color.g;
        carr[n * 3 + 2] = color.b;
        n += 1;
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.particleGeo.setDrawRange(0, n);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
