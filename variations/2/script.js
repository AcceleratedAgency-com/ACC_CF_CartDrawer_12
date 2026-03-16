window.acceleratedDataQueue = window.acceleratedDataQueue || [];
window.acceleratedDataQueue.push({
  'ACC_CF_CartDrawer_12': {
    var: {
      NEW_FREE_SHIPPING_THRESHOLD: 170,
      DISCOUNT_CODE: 'FreeShipping170',
      SESSION_FORCED_KEY: 'ACC_CF_CartDrawer_12_forced_once',
    },
    getCartJson: function () {
      return fetch('/cart.js').then(r => r.json());
    },
    isDiscountPresent: function (cart) {
      const apps1 = cart?.discount_codes || [];
      return [...apps1].some(a => (a?.code || '') === this.var.DISCOUNT_CODE);
    },
    updateFreeShippingThreshold: function () {
      this.runAt('div[data-free-shipping="true"]', (dataEls) => {
        dataEls.forEach((el) => el.setAttribute('data-free-shipping-limit', this.var.NEW_FREE_SHIPPING_THRESHOLD));

        const cart = window.cart;
        if (cart && typeof cart.getCart === 'function') cart.getCart();
      });
    },
    setDiscountCode: function () {
      return fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount: this.var.DISCOUNT_CODE })
      }).catch(error => this.testFailed('Error applying discount:', error));
    },
    init() {
      (async () => {
          const forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';
          const cart = await this.getCartJson().catch(() => {
              this.testFailed('Could not fetch cart JSON');
              return null;
          });
          const discountPresent = cart ? this.isDiscountPresent(cart) : false;
          //if discount is not present in the cart and we already forced it once
          if (!discountPresent && forcedOnce) return;
          //if discount is not present in the cart and we haven't forced it once
          if (!discountPresent && !forcedOnce) {
            sessionStorage.setItem(this.var.SESSION_FORCED_KEY, '1');
            this.updateFreeShippingThreshold();
            return new PerformanceObserver(function (e) {
                !e.getEntriesByType("resource").some(({ name }) => /\/cart\/(change|update|add|clear)/i.test(name)) || this.setDiscountCode()
            }.bind(this)).observe({ entryTypes: ["resource"] });
          }
          //if discount is present in the cart
          if (discountPresent) return this.updateFreeShippingThreshold();
      })().catch(e => this.testFailed('init error:', e));
    }
  }
});
