/**
 * The History screen: past scans, one removable row each, and a clear-all button.
 */

import { BasePage } from './base.page.js';

class HistoryPage extends BasePage {
  get items() {
    return $$('.history-item');
  }

  get empty() {
    return $('p=Nothing scanned yet.');
  }

  get clearAllButton() {
    return $('button*=Clear all');
  }

  /** @param {string} productName */
  removeButton(productName) {
    return $(`button[aria-label="Remove ${productName} from history"]`);
  }

  /**
   * The product names currently listed, top to bottom.
   *
   * `map()` on a WebdriverIO element array is async and already returns a Promise of the
   * results, so it must not be wrapped in `Promise.all`.
   */
  names() {
    return this.items.map((row) => row.$('.history-name strong').getText());
  }
}

export default new HistoryPage();
