// # PREVIEW CONDITIONS START #
window.acceleratedDataPreviewOnly = window.acceleratedDataPreviewOnly || [];
window.acceleratedDataPreviewOnly.push(`${experimentId}`);
let __urlQuery=new Map(window.location.search.replace(/^\?/,"").split("&").filter(_=>!!_).map(i=>i.split("=")));
let previewModeOption = 'xlr8d--varify-preview';
let previewExperiments = (__urlQuery.get(previewModeOption) || window.localStorage.getItem(previewModeOption) || '').split(',');
if (!previewExperiments.includes(`${experimentId}`)) return !1;
// # PREVIEW CONDITIONS END #
return new Promise((run,die) => {
    if ([
        'Google-Extended',     
        'Google-InspectionTool',     
        'Googlebot',     
        'GoogleOther',     
        'Storebot-Google'
    ].some(agent=>new RegExp(agent,'i').test(window.navigator?.userAgent))) return die();
    run(true); // you can delay "run(true)" with any additional condition, if you need to have some more specific targeting
    // https://www.notion.so/schroeder-weische/Split-test-targeting-snippets-7457f5a0d97a424991fce143fc27a187
});