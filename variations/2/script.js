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
            const codes = cart?.discount_codes || [];
            return codes.some(a => (a?.code || '') === this.var.DISCOUNT_CODE);
        },

        updateFreeShippingThreshold: function (cart) {
            this.runAt('div[data-free-shipping="true"]', (dataEls) => {
                dataEls.forEach((el) => {
                    el.setAttribute('data-free-shipping-limit', this.var.NEW_FREE_SHIPPING_THRESHOLD);

                    if (!cart || typeof cart.total_price !== 'number') {
                        el.classList.remove('is-success');
                        return;
                    }

                    const forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';
                    const meetsThreshold = cart.total_price >= this.var.NEW_FREE_SHIPPING_THRESHOLD * 100;

                    // Reflect test state on widget: success class only when test discount was forced and threshold is met
                    if (forcedOnce && meetsThreshold) {
                        el.classList.add('is-success');
                    } else {
                        el.classList.remove('is-success');
                    }

                    const leftCents = this.var.NEW_FREE_SHIPPING_THRESHOLD * 100 - cart.total_price;
                    const safeLeftCents = leftCents > 0 ? leftCents : 0;
                    const leftValue = (safeLeftCents / 100).toFixed(2);

                    const leftSpan = el.querySelector('[data-left-to-spend]');
                    if (leftSpan) {
                        const currentText = leftSpan.textContent || '';
                        const match = currentText.match(/(^\D*)([\d.,]+)(.*$)/);

                        if (match) {
                            leftSpan.textContent = `${match[1]}${leftValue}${match[3]}`;
                        } else {
                            leftSpan.textContent = leftValue;
                        }
                    }

                    const percent = Math.min(
                        (cart.total_price / (this.var.NEW_FREE_SHIPPING_THRESHOLD * 100)) * 100,
                        100
                    );

                    el.querySelectorAll('[data-progress-bar]').forEach((bar) => {
                        bar.setAttribute('value', String(percent));
                    });
                });
            });
        },

        setDiscountCode: function () {
            return fetch('/cart/update.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discount: this.var.DISCOUNT_CODE })
            }).catch(error => this.testFailed('Error applying discount:', error));
        },

        observeCartChanges: function () {
            if (this._observerAttached) return;
            this._observerAttached = true;

            const handleCartChange = this.debounce(() => {
                this.getCartJson()
                    .then((latestCart) => {
                        if (!latestCart || typeof latestCart.total_price !== 'number') return;

                        const discountPresent = this.isDiscountPresent(latestCart);
                        const meetsThreshold =
                            latestCart.total_price >= this.var.NEW_FREE_SHIPPING_THRESHOLD * 100;
                        const forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';

                        // Apply discount when threshold reached and not yet forced
                        if (!discountPresent && meetsThreshold && !forcedOnce) {
                            sessionStorage.setItem(this.var.SESSION_FORCED_KEY, '1');
                            return this.setDiscountCode();
                        }

                        // Always sync widget state 
                        this.updateFreeShippingThreshold(latestCart);
                    })
                    .catch(this.error || function () { });
            }, 300);

            new PerformanceObserver((list) => {
                const hasCartCall = list.getEntries().some(({ name }) =>
                    /\/cart\/(change|update|add|clear)/i.test(name)
                );

                if (hasCartCall) {
                    handleCartChange();
                }
            }).observe({ entryTypes: ['resource'] });
        },

        init() {
            (async () => {
                let forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';

                const cart = await this.getCartJson().catch(() => {
                    this.testFailed('Could not fetch cart JSON');
                    return null;
                });

                const discountPresent = cart ? this.isDiscountPresent(cart) : false;
                const meetsThreshold = cart && typeof cart.total_price === 'number'
                    ? cart.total_price >= this.var.NEW_FREE_SHIPPING_THRESHOLD * 100
                    : false;

                this.updateFreeShippingThreshold(cart);

                if (!discountPresent && forcedOnce) {
                    sessionStorage.removeItem(this.var.SESSION_FORCED_KEY);
                    forcedOnce = false;
                }

                // If no discount, not forced yet and threshold is met on initial load – apply once
                if (!discountPresent && !forcedOnce && meetsThreshold) {
                    sessionStorage.setItem(this.var.SESSION_FORCED_KEY, '1');

                    this.setDiscountCode();
                    this.observeCartChanges();

                    return;
                }

                // In all other cases just attach observer to react on future cart changes
                if (discountPresent || !forcedOnce) {
                    this.observeCartChanges();
                    return;
                }

            })().catch(e => this.testFailed('init error:', e));
        }
    }
});