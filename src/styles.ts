import { css } from 'lit';

export const sharedStyles = css`
  :host {
    --np-spacing: 8px;
    --np-radius: 12px;
    --np-auto-color: var(--primary-color);
    --np-override-color: var(--accent-color, #ff9800);
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .auto-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 16px;
    border: 1px solid var(--divider-color);
    background: transparent;
    color: var(--secondary-text-color);
    font: inherit;
    font-size: 0.8em;
    font-weight: 500;
    cursor: pointer;
  }

  .auto-chip.enabled {
    background: var(--np-auto-color);
    border-color: var(--np-auto-color);
    color: var(--text-primary-color, #fff);
  }

  .auto-chip:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .icon-button {
    display: inline-flex;
    padding: 4px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .icon-button.active {
    color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  }

  .chip-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  .button-icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .settings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--np-spacing);
    padding: var(--np-spacing);
    margin-bottom: var(--np-spacing);
    border-radius: var(--np-radius);
    background: var(--secondary-background-color);
  }

  .setting {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .setting-toggle {
    justify-content: center;
  }

  .setting-toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--np-auto-color);
  }

  .setting-label {
    font-size: 0.75em;
    color: var(--secondary-text-color);
  }

  .setting input[type='number'] {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border: 1px solid var(--divider-color);
    border-radius: 6px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font: inherit;
  }

  .setting-hint {
    font-size: 0.7em;
    color: var(--secondary-text-color);
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

  .slot-marker {
    position: absolute;
    top: 3px;
    width: 12px;
    height: 12px;
  }

  .auto-marker {
    left: 3px;
    fill: var(--np-auto-color);
  }

  .time-slot.auto-pick.overridden:not(.on) .auto-marker {
    opacity: 0.35;
  }

  .override-marker {
    right: 3px;
    fill: var(--np-override-color);
  }

  .time-slot.overridden {
    border-style: dashed;
  }

  .time-slot.overridden.on {
    border-color: var(--np-override-color);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: var(--np-spacing);
    font-size: 0.75em;
    color: var(--secondary-text-color);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .legend-icon {
    width: 14px;
    height: 14px;
  }

  .legend-icon.auto {
    fill: var(--np-auto-color);
  }

  .legend-icon.manual {
    fill: var(--np-override-color);
  }

  .legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 3px solid var(--primary-color);
    box-sizing: border-box;
  }

  .placeholder-message {
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 0.85em;
    padding: calc(var(--np-spacing) * 2) 0;
  }
`;
