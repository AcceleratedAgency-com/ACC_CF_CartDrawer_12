return (async conditions => {
    let wait = 20;
    while (wait--) {
        let c = await Promise.allSettled(conditions.map(f => f())).catch(() => { }) || [];
        if (c.filter(({ value }) => !!value).length === conditions.length) return !0;
        await new Promise(r => setTimeout(r, 150));
    }
    throw new Error();
})([
    () => {
        return window.Shopify?.currency?.active === 'AUD' || window.Shopify?.currency?.active === 'EUR' || window.Shopify?.currency?.active === 'GBP' || window.Shopify?.currency?.active === 'USD';
    },
    () => {
        return document.documentElement.lang === 'en'
    }
]);
