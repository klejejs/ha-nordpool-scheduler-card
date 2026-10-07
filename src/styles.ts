import { css } from 'lit';

export const sharedStyles = css`
  :host {
    --np-spacing: 8px;
    --np-radius: 12px;
  }

  ha-card {
    padding: calc(var(--np-spacing) * 1.5);
    box-sizing: border-box;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--np-spacing);
  }

  .card-title {
    font-size: 1.2em;
    font-weight: 500;
    margin: 0;
    color: var(--primary-text-color);
  }

  .info-bar {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: var(--np-spacing);
    padding: calc(var(--np-spacing) * 0.75) 0;
    margin-bottom: var(--np-spacing);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .info-label {
    font-size: 0.7em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
  }

  .info-value {
    font-size: 1em;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .day-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: var(--np-spacing);
  }

  .day-tab {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: var(--np-radius);
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
    font-weight: 500;
    cursor: pointer;
  }

  .day-tab.active {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }

  .day-heading {
    font-size: 0.9em;
    font-weight: 500;
    color: var(--secondary-text-color);
    margin: var(--np-spacing) 0 4px;
  }

  .history-container {
    margin-bottom: var(--np-spacing);
  }

  .history-label {
    font-size: 0.75em;
    color: var(--secondary-text-color);
    margin-bottom: 4px;
  }

  .history-bar {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: var(--divider-color);
    overflow: hidden;
  }

  .history-segment {
    position: absolute;
    top: 0;
    bottom: 0;
  }

  .history-segment.on {
    background: var(--success-color);
  }

  .history-segment.off {
    background: var(--disabled-text-color);
  }

  .schedule-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    width: 100%;
  }

  .time-slot {
    position: relative;
    aspect-ratio: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: calc(var(--np-radius) / 1.5);
    cursor: pointer;
    background: var(--card-background-color);
    border: 2px solid var(--divider-color);
    box-sizing: border-box;
    padding: 2px;
    overflow: hidden;
  }

  .time-slot.tier-low {
    border-color: color-mix(in srgb, var(--success-color) 50%, var(--divider-color));
    background: color-mix(in srgb, var(--success-color) 10%, var(--card-background-color));
  }

  .time-slot.tier-mid {
    border-color: color-mix(in srgb, var(--warning-color) 45%, var(--divider-color));
    background: color-mix(in srgb, var(--warning-color) 10%, var(--card-background-color));
  }

  .time-slot.tier-high {
    border-color: color-mix(in srgb, var(--error-color) 50%, var(--divider-color));
    background: color-mix(in srgb, var(--error-color) 10%, var(--card-background-color));
  }

  .time-slot.on {
    border-color: var(--primary-color);
    border-width: 3px;
  }

  .time-slot.current {
    box-shadow: 0 0 0 2px var(--primary-color) inset;
  }

  .time-slot.past {
    opacity: 0.45;
    cursor: default;
  }

  .time-slot.readonly {
    cursor: default;
  }

  .time-slot.pending {
    opacity: 0.65;
  }

  .time-label {
    font-size: 0.75em;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .price-label {
    font-size: 0.7em;
    color: var(--secondary-text-color);
  }

  .override-dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary-color);
  }

  .placeholder-message {
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 0.85em;
    padding: calc(var(--np-spacing) * 2) 0;
  }
`;
