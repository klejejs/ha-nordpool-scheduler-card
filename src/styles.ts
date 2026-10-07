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

  .info-hint {
    font-size: 0.7em;
    color: var(--secondary-text-color);
  }

  .averages-title {
    display: block;
    font-size: 0.7em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
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

  .price-label {
    font-size: 0.85em;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .time-label {
    font-size: 0.65em;
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

  :host([density]) {
    --np-spacing: 4px;
    --np-radius: 6px;
  }

  :host([density]) ha-card {
    padding: 8px;
  }

  :host([density]) .card-title {
    font-size: 1em;
  }

  :host([density]) .auto-chip {
    padding: 2px 8px;
    font-size: 0.75em;
  }

  :host([density]) .icon-button {
    padding: 2px;
  }

  :host([density]) .settings {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }

  :host([density]) .info-bar {
    gap: 2px;
    padding: 0;
  }

  :host([density]) .info-label,
  :host([density]) .averages-title,
  :host([density]) .info-hint {
    font-size: 0.6em;
  }

  :host([density]) .info-value {
    font-size: 0.8em;
  }

  :host([density]) .day-tab {
    padding: 4px;
    font-size: 0.85em;
  }

  :host([density]) .day-heading {
    font-size: 0.8em;
    margin: var(--np-spacing) 0 2px;
  }

  :host([density]) .history-label {
    font-size: 0.65em;
    margin-bottom: 2px;
  }

  :host([density]) .history-bar {
    height: 6px;
  }

  :host([density]) .schedule-grid {
    gap: 2px;
  }

  :host([density]) .time-slot {
    aspect-ratio: auto;
    gap: 0;
    padding: 4px 2px;
    border-width: 1px;
  }

  :host([density]) .time-slot.on {
    border-width: 2px;
  }

  :host([density]) .slot-marker {
    top: 1px;
    width: 10px;
    height: 10px;
  }

  :host([density]) .auto-marker {
    left: 1px;
  }

  :host([density]) .override-marker {
    right: 1px;
  }

  :host([density='super_compact']) .schedule-grid {
    grid-template-columns: repeat(8, 1fr);
  }

  :host([density='super_compact']) .time-slot {
    padding: 3px 1px;
  }

  :host([density='super_compact']) .price-label {
    font-size: 0.7em;
  }

  :host([density='super_compact']) .time-label {
    font-size: 0.55em;
  }

  :host([density='super_compact']) .slot-marker {
    top: 0;
    width: 8px;
    height: 8px;
  }

  :host([density='super_compact']) .auto-marker {
    left: 0;
  }

  :host([density='super_compact']) .override-marker {
    right: 0;
  }

  :host([density='super_compact']) .time-slot.on .slot-marker {
    top: -1px;
  }

  :host([density='super_compact']) .time-slot.on .auto-marker {
    left: -1px;
  }

  :host([density='super_compact']) .time-slot.on .override-marker {
    right: -1px;
  }

  :host([density]) .legend {
    gap: 8px;
    font-size: 0.65em;
  }

  :host([density]) .legend-icon {
    width: 10px;
    height: 10px;
  }

  :host([density]) .legend-swatch {
    width: 10px;
    height: 10px;
    border-width: 2px;
  }
`;
