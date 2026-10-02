import { attachMageAI, mageInput, type Games, type InputFrame, type MageBrain } from '@mage/core/arena';
/** External scripted player. Observes the current frame only and emits ordinary inputs.
 * Its decision RNG/memory never enters the authoritative arena actor or state. */
export class SeasonPolicy {
  private brain?: MageBrain;
  private rng = 71;
  private wave = -1;
  frame(g: Games): InputFrame {
    const actor = { ...g.player, mageAI: this.brain };
    if (!this.brain || this.wave !== g.wave) { attachMageAI(actor, 3, g.state.tick); this.wave = g.wave; }
    const observation = { ...g.state, actors: g.state.actors.map(a => a.id === actor.id ? actor : a), rng: this.rng, randomLog: [] };
    const input = mageInput(observation, actor);
    this.brain = actor.mageAI; this.rng = observation.rng;
    return input;
  }
}
