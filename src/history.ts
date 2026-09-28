import type { HistorySegment, HistoryStreamMessage } from './types';

interface RawState {
  s: string;
  lu: number;
}

/** Accumulates history/stream messages into on/off segments, as the frontend's own HistoryStream does. */
export class HistoryAccumulator {
  private _states: RawState[] = [];

  public addMessage(msg: HistoryStreamMessage, entityId: string, hoursToShow: number): void {
    const incoming = msg.states[entityId];
    if (!incoming?.length) {
      return;
    }
    this._states =
      this._states.length === 0
        ? incoming
        : this._states.concat(incoming).sort((a, b) => a.lu - b.lu);
    const cutoff = Date.now() / 1000 - hoursToShow * 3600;
    const cutoffIndex = this._states.findIndex((s) => s.lu >= cutoff);
    if (cutoffIndex > 0) {
      this._states = this._states.slice(cutoffIndex - 1);
    }
  }

  public segments(): HistorySegment[] {
    const now = new Date();
    return this._states.map((state, i) => ({
      state: state.s,
      start: new Date(state.lu * 1000),
      end: i + 1 < this._states.length ? new Date(this._states[i + 1].lu * 1000) : now,
    }));
  }
}
