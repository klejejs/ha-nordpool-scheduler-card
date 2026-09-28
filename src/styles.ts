import { css } from 'lit';

export const sharedStyles = css`
  :host {
    --spacing: 8px;
    --border-radius: 12px;
    --icon-size: 40px;
    --button-size: 48px;
    --yellow-color: #ffeb3b;
  }

  ha-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-radius: var(--border-radius);
    padding: calc(var(--spacing) * 1.5);
    box-sizing: border-box;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing);
  }

  .card-title {
    font-size: 1.2em;
    font-weight: 500;
    margin: 0;
    color: var(--primary-text-color);
  }

  .schedule-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: calc(var(--spacing) / 2);
    width: 100%;
  }

  .time-slot {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: calc(var(--border-radius) / 1.5);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    background: var(--card-background-color);
    border: 2px solid var(--divider-color);
    padding: 4px;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  .schedule-grid.compact .time-slot {
    aspect-ratio: auto;
    padding: 6px 4px;
    min-height: 40px;
  }

  .time-slot:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .time-slot.selected {
    border-color: var(--info-color);
    background: rgba(var(--rgb-info-color, 3, 169, 244), 0.1);
  }

  .time-slot.current {
    border-width: 3px;
    border-color: var(--primary-color);
  }

  .time-slot.tomorrow::after {
    content: 'tmrw';
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 0.65em;
    font-weight: 600;
    color: var(--primary-color);
    background: var(--card-background-color, #fff);
    padding: 1px 3px;
    border-radius: 3px;
    border: 1px solid var(--primary-color);
  }

  .time-slot.past {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--disabled-color, #e0e0e0);
  }

  .time-slot.past:hover {
    transform: none;
    box-shadow: none;
  }

  .time-slot.past .time-label,
  .time-slot.past .price-label {
    color: var(--disabled-text-color);
  }

  .time-label {
    font-size: 0.9em;
    font-weight: 500;
    color: var(--primary-text-color);
    margin-bottom: 2px;
    white-space: nowrap;
  }

  .price-label {
    font-size: 0.8em;
    font-weight: 600;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .time-slot .price-label {
    transition: color 0.2s ease-in-out;
  }

  .hour-divider {
    grid-column: 1 / -1;
    height: 1px;
    background: var(--divider-color);
    margin: var(--spacing) 0;
  }

  .info-bar {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: var(--spacing);
    background: var(--secondary-background-color);
    border-radius: calc(var(--border-radius) / 2);
    margin-bottom: var(--spacing);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .info-label {
    font-size: 0.7em;
    color: var(--secondary-text-color);
    text-transform: uppercase;
    font-weight: 500;
  }

  .info-value {
    font-size: 0.9em;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .info-value.success {
    color: var(--success-color);
  }

  .info-value.error {
    color: var(--error-color);
  }

  .info-value.warning {
    color: var(--warning-color);
  }

  .history-container {
    display: flex;
    align-items: center;
    gap: var(--spacing);
    padding: calc(var(--spacing) / 2) var(--spacing);
    background: var(--secondary-background-color);
    border-radius: calc(var(--border-radius) / 2);
    margin-bottom: var(--spacing);
  }

  .history-label {
    font-size: 0.7em;
    color: var(--secondary-text-color);
    text-transform: uppercase;
    font-weight: 500;
    white-space: nowrap;
    min-width: 60px;
  }

  .history-bar {
    position: relative;
    flex: 1;
    height: 24px;
    background: var(--disabled-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .history-segment {
    position: absolute;
    top: 0;
    height: 100%;
    transition: opacity 0.2s;
  }

  .history-segment:hover {
    opacity: 0.8;
  }

  .history-segment.on {
    background: var(--warning-color);
  }

  .history-segment.off {
    background: var(--disabled-text-color);
    opacity: 0.5;
  }

  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(var(--spacing) * 3);
    text-align: center;
    gap: var(--spacing);
  }

  .error-message ha-icon {
    --mdc-icon-size: 48px;
    color: var(--error-color);
  }

  .error-title {
    font-size: 1.2em;
    font-weight: 600;
    color: var(--primary-text-color);
    margin-top: var(--spacing);
  }

  .error-details {
    font-size: 0.9em;
    color: var(--secondary-text-color);
    line-height: 1.5;
    max-width: 400px;
  }

  .error-details ul {
    text-align: left;
    margin: var(--spacing) 0;
    padding-left: calc(var(--spacing) * 2);
  }

  .error-details li {
    margin: 4px 0;
  }

  .error-details strong {
    color: var(--primary-text-color);
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(var(--spacing) * 4);
  }

  .day-tabs {
    display: flex;
    gap: calc(var(--spacing) / 2);
    padding: 0 var(--spacing) var(--spacing) var(--spacing);
  }

  .day-tab {
    flex: 1;
    padding: 10px 16px;
    background: var(--card-background-color);
    border: 2px solid var(--divider-color);
    border-radius: calc(var(--border-radius) / 2);
    color: var(--primary-text-color);
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .day-tab:hover {
    background: var(--secondary-background-color);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .day-tab.active {
    background: var(--primary-color);
    color: var(--text-primary-color, white);
    border-color: var(--primary-color);
  }
`;
