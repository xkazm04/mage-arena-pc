import { Graphics, GraphicsPipe } from "pixi.js";

/**
 * Pixi 8.22's GraphicsPipe.validateRenderable reads "was batched" as `!!graphics._gpuData`, an object that always
 * exists, so redrawing an unbatched Graphics rebuilds the whole render group's instructions every frame (~4 ms a frame
 * on the Fire TV). This reads it from the renderer's own batches instead: an unbatched Graphics that stays unbatched
 * updates its geometry in place, as Pixi intends. Batched Graphics keep Pixi's behaviour.
 */
const proto = GraphicsPipe.prototype as unknown as {
  renderer: {
    uid: number;
    graphicsContext: { updateGpuContext(c: unknown): { isBatchable: boolean } };
  };
  validateRenderable(g: Graphics): boolean;
};
proto.validateRenderable = function (graphics: Graphics) {
  const data = (
    graphics as unknown as {
      _gpuData: Record<number, { batches: unknown[] } | undefined>;
    }
  )._gpuData[this.renderer.uid];
  const wasBatched = !data || data.batches.length > 0;
  const gpuContext = this.renderer.graphicsContext.updateGpuContext(
    graphics.context,
  );
  return gpuContext.isBatchable || wasBatched !== gpuContext.isBatchable;
};

/** A Graphics redrawn every frame: unbatched, so a redraw updates its own geometry instead of rebuilding the stage. */
export function frameGraphics(g = new Graphics()): Graphics {
  g.context.batchMode = "no-batch";
  return g;
}
