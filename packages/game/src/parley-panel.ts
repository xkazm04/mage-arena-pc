import type { CampService, ParleyInput } from "@mage/director";
type View = ReturnType<CampService["view"]>;
type Moment = View["parley"]["moments"][number];
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export class ParleyPanel {
  readonly dialog = document.createElement("dialog");
  private pending = false;
  constructor(
    readonly submit: (input: ParleyInput, revision: number) => Promise<View>,
  ) {
    this.dialog.className = "parley-dialog";
    this.dialog.setAttribute("aria-label", "A Knowing moment");
    this.dialog.addEventListener("cancel", (e) => {
      if (this.pending) e.preventDefault();
    });
    document.body.append(this.dialog);
  }
  open(moment: Moment, view: View) {
    if (this.pending) return;
    this.dialog.innerHTML = `<div class="parley-heading"><div><p class="eyebrow">A KNOWING MOMENT / ${view.slot.toUpperCase()}</p><h2>Speak with ${escape(moment.name)}</h2></div><button data-parley-close aria-label="Close Parley">Close</button></div>
    <div class="parley-columns"><section><p class="eyebrow">WHAT YOU KNOW</p><blockquote>${escape(moment.cards[0].knowing)}</blockquote><p class="meta">Speaking ends this time slot. You can make an appeal once per day. A Knowing gives your words weight; it does not guarantee agreement.</p><h3>Choose your words</h3><div class="parley-cards">${moment.cards.map((card) => `<button class="action" data-parley-card="${card.id}"><strong>${escape(card.title)}</strong><small>${escape(card.text)}</small></button>`).join("")}</div></section>
    <section><h3>Or speak in your own words</h3><label for="parley-approach">Your approach</label><select id="parley-approach">${moment.cards.map((card) => `<option value="${card.id}">${escape(card.title)}</option>`).join("")}</select><label for="parley-text">What do you say?</label><textarea id="parley-text" maxlength="${view.parley.maxTextChars}" rows="6" placeholder="I know about the bread by the southern tent rope…"></textarea><p class="parley-count meta">0 / ${view.parley.maxTextChars}</p><p class="meta">${view.parley.canType ? "If a reply cannot reach you, your chosen approach carries the conversation." : "This camp uses authored replies. Your chosen approach determines the response to your words."}</p><button class="primary" data-parley-speak>Speak</button><div class="parley-result" role="status" aria-live="polite"></div></section></div>`;
    this.dialog.querySelector<HTMLButtonElement>(
      "[data-parley-close]",
    )!.onclick = () => this.dialog.close();
    const field = this.dialog.querySelector<HTMLTextAreaElement>("textarea")!;
    field.oninput = () => {
      this.dialog.querySelector(".parley-count")!.textContent =
        `${Array.from(field.value).length} / ${view.parley.maxTextChars}`;
    };
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>(
      "[data-parley-card]",
    ))
      button.onclick = () =>
        void this.speak(
          { target: moment.target, cardId: button.dataset.parleyCard! },
          view.revision,
        );
    this.dialog.querySelector<HTMLButtonElement>(
      "[data-parley-speak]",
    )!.onclick = () => {
      if (!field.value.trim()) {
        field.focus();
        return;
      }
      void this.speak(
        {
          target: moment.target,
          cardId: this.dialog.querySelector<HTMLSelectElement>("select")!.value,
          text: field.value,
        },
        view.revision,
      );
    };
    this.dialog.showModal();
  }
  private async speak(input: ParleyInput, revision: number) {
    if (this.pending) return;
    this.pending = true;
    for (const el of this.dialog.querySelectorAll<
      HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
    >("button,textarea,select"))
      el.disabled = true;
    const result = this.dialog.querySelector<HTMLElement>(".parley-result")!;
    result.textContent =
      "They weigh your words. The lantern burns between you.";
    try {
      const next = await this.submit(input, revision),
        reply = next.parley.last!;
      const consequences = reply.trustDelta
        ? `${reply.trustDelta > 0 ? "+" : ""}${reply.trustDelta} trust toward you.`
        : reply.effect === "flip_next_intent"
          ? "They will attempt a friendly act toward you tonight."
          : reply.revealed
            ? `A new Knowing: ${reply.revealed}`
            : "They keep their own counsel. The moment passes.";
      result.innerHTML = `<p class="eyebrow">${escape(reply.name)} ANSWERS</p><p class="reply">“${escape(reply.reply)}”</p><p>${escape(consequences)}</p><p class="meta">${reply.usedCard && input.text ? "Your chosen approach carried this conversation. " : ""}The ${next.slot} slot is now ${next.nightFinished ? "finished" : "upon you"}.</p>`;
      const close = this.dialog.querySelector<HTMLButtonElement>(
        "[data-parley-close]",
      )!;
      close.disabled = false;
      close.textContent = "Return to camp";
      close.focus();
    } catch (e) {
      result.textContent =
        e instanceof Error ? e.message : "The moment could not be completed.";
      for (const el of this.dialog.querySelectorAll<
        HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
      >("button,textarea,select"))
        el.disabled = false;
    } finally {
      this.pending = false;
    }
  }
}
