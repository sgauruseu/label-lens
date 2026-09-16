/**
 * The Scan screen: the barcode form, the sample chips, and the verdict that replaces them.
 */

import { BasePage } from './base.page.js';

class ScanPage extends BasePage {
  get barcodeInput() {
    return $('input[aria-label="Barcode"]');
  }

  get lookUpButton() {
    return $('button=Look up');
  }

  get samplesToggle() {
    return $('.chip-toggle');
  }

  get sampleChips() {
    return $$('.chip-group');
  }

  get restoreSamplesButton() {
    return $('button=Restore removed');
  }

  /** @param {string} barcode */
  removeSampleButton(barcode) {
    return $(`button[aria-label="Remove ${barcode} from the examples"]`);
  }

  // ---- verdict ----

  get productName() {
    return $('.verdict-title h2');
  }

  get score() {
    return $('.ring-value');
  }

  get band() {
    return $('.ring-band');
  }

  get scoreRows() {
    return $$('.contrib-points');
  }

  get alternativesButton() {
    return $('button=Find better alternatives');
  }

  get alternatives() {
    return $$('.alt');
  }

  /**
   * Looks a barcode up through the form, exactly as a person would.
   *
   * @param {string} barcode
   */
  async lookUp(barcode) {
    await this.barcodeInput.setValue(barcode);
    await this.lookUpButton.click();
    await this.productName.waitForDisplayed();
  }
}

export default new ScanPage();
