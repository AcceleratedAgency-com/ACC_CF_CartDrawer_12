window.acceleratedDataQueue = window.acceleratedDataQueue || [];
window.acceleratedDataQueue.push({
    'ACC_CF_CartDrawer_12': {
        var: {
            NEW_FREE_SHIPPING_THRESHOLD: 150,
            DISCOUNT_CODE: 'FreeShipping150',
            SESSION_FORCED_KEY: 'ACC_CF_CartDrawer_12_forced_once_v1',

            get ['/']() {
                return window.Shopify?.routes?.root || '/';
            },
            get currency() {
                return window.Shopify?.currency?.active;
            },
            get currencyRate() {
                return Number(window.Shopify?.currency?.rate) || 1;
            },
            get freeShippingThresholdCents() {
                return Math.round(this.NEW_FREE_SHIPPING_THRESHOLD * this.currencyRate * 100);
            },
            refPriceFormat: '',
        },

        currencyFormat: function (n, fractionDigits = 2) {
            const currency = this.var.currency || 'AUD';
            const locale = this.var.locale || 'en';
            const country = this.var.country || 'AU';
            return Intl.NumberFormat(`${locale}-${country}`, {
                style: 'currency',
                currency: currency,
                currencyDisplay: 'narrowSymbol',
                minimumFractionDigits: fractionDigits,
                maximumFractionDigits: fractionDigits,
                minimumIntegerDigits: 1,
                useGrouping: true,
            }).format(n);
        },


        formatPrice(n) {
            if (!+n) return '';
            let b = (this.var.refPriceFormat || '').match(/^(.*)99(.*)000((.)00)?(.*)$/);
            if (!b) return this.currencyFormat(+n);
            let [, prefix, thousand, _, decimal, suffix] = b;
            let [amount, reminder] = (+n).toFixed(decimal ? 2 : 0).split('.');
            return (
                prefix +
                [...amount].reduce((r, v, idx, { length }) => {
                    let b = length - idx - 1;
                    return (r += !b ? v : b % 3 ? v : v + thousand);
                }, '') +
                (decimal && reminder ? decimal + reminder : '') +
                suffix
            );
        },


        getCartJson: function () {
            return fetch('/cart.js').then(r => r.json());
        },

        ensureFreeShippingObserverAttached: function () {
            if (this._freeShippingObserverAttached) return;
            this._freeShippingObserverAttached = true;

            const doc = window.document;
            const MutationObserver =
                window.MutationObserver || window.WebKitMutationObserver;

            // One light observer for DOM changes; updates are guarded to avoid loops.
            const obs = new MutationObserver(() => {
                const latest = this._freeShippingLatestCart;
                if (!latest) return;
                if (Date.now() - (this._freeShippingLastAppliedAt || 0) < 400)
                    return;
                this.updateFreeShippingThreshold(latest);
            });

            obs.observe(doc.documentElement, { childList: true, subtree: true });
        },

        isDiscountPresent: function (cart) {
            const codes = cart?.discount_codes || [];
            return codes.some(a => (a?.code || '') === this.var.DISCOUNT_CODE);
        },

        updateFreeShippingThreshold: function (cart) {
            this.runAt('div[data-free-shipping="true"]', (dataEls) => {
                dataEls.forEach((el) => {
                    if (!el) return;
                    this._freeShippingLatestCart = cart;
                    this._freeShippingLastAppliedAt = Date.now();

                    this.ensureFreeShippingObserverAttached();

                    el.setAttribute(
                        'data-free-shipping-limit',
                        String((this.var.freeShippingThresholdCents / 100).toFixed(2))
                    );

                    if (!cart || typeof cart.total_price !== 'number') {
                        el.classList.remove('is-success');
                        return;
                    }
                    const discountPresent = this.isDiscountPresent(cart);
                    const forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';


                    const cartTotalCents = cart.total_price;
                    const cartActiveCents = cartTotalCents; // already in active cents
                    const thresholdActiveCents = this.var.freeShippingThresholdCents;

                    const meetsThreshold = cartActiveCents >= thresholdActiveCents;

                    if (meetsThreshold && (discountPresent || forcedOnce)) {
                        el.classList.add('is-success');
                    } else {
                        el.classList.remove('is-success');
                    }

                    // left-to-spend must be displayed relative to active threshold
                    const leftCents = thresholdActiveCents - cartActiveCents;
                    const safeLeftActiveCents = leftCents > 0 ? leftCents : 0;
                    const decimals = safeLeftActiveCents % 100 === 0 ? 0 : 2;
                    const leftValueRaw = this.currencyFormat(safeLeftActiveCents / 100, decimals);
                    const leftValue =
                        this.var.currency === 'EUR'
                            ? leftValueRaw.replace(/(\d)\.(\d{2})/, '$1,$2')
                            : leftValueRaw;


                    const leftSpan = el.querySelector('[data-left-to-spend]');
                    if (leftSpan) {
                        leftSpan.textContent = leftValue;
                    }

                    const percent = Math.min((cartActiveCents / thresholdActiveCents) * 100, 100);

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
                        const cartTotalCents = latestCart.total_price;
                        const thresholdActiveCents = this.var.freeShippingThresholdCents;
                        const cartActiveCents = cartTotalCents; // already in active cents
                        const meetsThreshold = cartActiveCents >= thresholdActiveCents;
                        const forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';

                        // Apply discount when threshold reached and not yet forced
                        if (!discountPresent && meetsThreshold && !forcedOnce) {
                            sessionStorage.setItem(this.var.SESSION_FORCED_KEY, '1');
                            this.updateFreeShippingThreshold(latestCart);
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

        run() {
            (async () => {
                let forcedOnce = sessionStorage.getItem(this.var.SESSION_FORCED_KEY) === '1';

                const cart = await this.getCartJson().catch(() => {
                    this.testFailed('Could not fetch cart JSON');
                    return null;
                });

                const discountPresent = cart ? this.isDiscountPresent(cart) : false;
                const meetsThreshold = cart && typeof cart.total_price === 'number'
                    ? (() => {
                        const cartTotalCents = cart.total_price;
                        const thresholdActiveCents = this.var.freeShippingThresholdCents;
                        const cartActiveCents = cartTotalCents; // already in active cents
                        return cartActiveCents >= thresholdActiveCents;
                    })()
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
                    this.updateFreeShippingThreshold(cart);
                    this.observeCartChanges();

                    return;
                }

                // In all other cases just attach observer to react on future cart changes
                if (discountPresent || !forcedOnce) {
                    this.observeCartChanges();
                    return;
                }

            })().catch(e => this.testFailed('init error:', e));
        },
        init() {
            this.runIf(
                () => this.var.currency,
                () => {
                    this.cache(this.var['/'] + '?section_id=acc-price-format-reference', this.var.currency, false)
                        .then((refPriceFormat) => {
                            this.var.refPriceFormat = refPriceFormat.split('##DELIMITER##')[1];
                        })
                        .catch(this.error)
                        .finally(this.run.bind(this));
                }, 50);
        }
    }
});