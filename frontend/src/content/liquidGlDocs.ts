type LiquidGlLink = {
    label: string
    href: string
}

type LiquidGlFeature = {
    name: string
    supported: boolean
}

type LiquidGlScript = {
    name: string
    src: string
    required: boolean
    purpose: string
}

type LiquidGlOption = {
    name: string
    type: string
    defaultValue: string
    required?: boolean
    description: string
}

type LiquidGlPresetSettings = {
    refraction: number
    bevelDepth: number
    bevelWidth: number
    frost: number
    shadow: boolean
    specular: boolean
}

type LiquidGlPreset = {
    name: string
    settings: LiquidGlPresetSettings
    purpose: string
}

type LiquidGlFaq = {
    question: string
    answer: string
}

type LiquidGlBrowserSupport = {
    browser: string
    supported: boolean
}

export const liquidGlIntro = {
    name: 'liquidGL',
    tagline: 'Ultra-light glassmorphism for the web',
    releaseLabel: 'Production Release',
    releaseNote: 'now with real-time support',
    statusNote:
        'liquidGL is free to use for both non-commercial and commercial purposes. BETA has ended and the library is ready for production use.',
    summary:
        'liquidGL turns fixed-position elements into refracted, glossy glass panes rendered in WebGL.',
    overview:
        'liquidGL recreates Apple Liquid Glass aesthetics in the browser with an ultra-light WebGL shader. It uses offscreen rendering to refract dynamic content such as videos, text animations, and other real-time page content.',
    promoImage: '/assets/liquidGlass-promo.gif',
} as const

export const liquidGlLinks: LiquidGlLink[] = [
    {
        label: 'Try it out',
        href: 'https://liquidgl.naughtyduk.com',
    },
    {
        label: 'Demo 1',
        href: 'https://liquidgl.naughtyduk.com/demos/demo-1.html',
    },
    {
        label: 'Demo 2',
        href: 'https://liquidgl.naughtyduk.com/demos/demo-2.html',
    },
    {
        label: 'Demo 3',
        href: 'https://liquidgl.naughtyduk.com/demos/demo-3.html',
    },
    {
        label: 'Demo 4',
        href: 'https://liquidgl.naughtyduk.com/demos/demo-4.html',
    },
    {
        label: 'Demo 5',
        href: 'https://liquidgl.naughtyduk.com/demos/demo-5.html',
    },
]

export const liquidGlFeatures: LiquidGlFeature[] = [
    { name: 'Real-time Refraction (static content)', supported: true },
    { name: 'Real-time Refraction (video)', supported: true },
    { name: 'Real-time Refraction (text animations)', supported: true },
    { name: 'Real-time Refraction (CSS animations)', supported: false },
    { name: 'Adjustable Bevel', supported: true },
    { name: 'Frosted Glass Effect', supported: true },
    { name: 'Dynamic Shadows', supported: true },
    { name: 'Specular Highlights', supported: true },
    { name: 'Interactive Tilt Effect', supported: true },
    { name: 'Magnification Control', supported: true },
    { name: 'Dynamic Element Support', supported: true },
    { name: 'GSAP-Ready Animations', supported: true },
    { name: 'Lightweight & Performant', supported: true },
    { name: 'Seamless Scroll Sync', supported: true },
    { name: 'Auto-Resize Handling', supported: true },
    { name: 'Auto Video Refraction', supported: true },
    { name: 'Animate Lenses', supported: true },
    { name: 'on.init Callback', supported: true },
]

export const liquidGlScripts: LiquidGlScript[] = [
    {
        name: 'html2canvas',
        src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        required: true,
        purpose: 'DOM snapshotter used to capture the high-resolution background texture.',
    },
    {
        name: 'liquidGL.js',
        src: '/scripts/liquidGL.js',
        required: true,
        purpose: 'The liquidGL library itself.',
    },
]

export const liquidGlCodeExamples = {
    prerequisites: `<!-- html2canvas - DOM snapshotter (required) -->
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
  defer
></script>

<!-- liquidGL.js - the library itself -->
<script src="/scripts/liquidGL.js" defer></script>`,
    quickStartHtml: `<!-- Example HTML structure -->
<body>
  <!-- Target (glassified) -->
  <div class="liquidGL">
    <!-- Content -->
    <div class="content">
      <img src="/example.svg" alt="Alt Text" />
      <p>This example text content will appear on top of the glass.</p>
    </div>
  </div>
</body>`,
    quickStartInit: `<script>
  document.addEventListener("DOMContentLoaded", () => {
    const glassEffect = liquidGL({
      snapshot: "body",
      target: ".liquidGL",
      resolution: 2.0,
      refraction: 0.01,
      bevelDepth: 0.08,
      bevelWidth: 0.15,
      frost: 0,
      shadow: true,
      specular: true,
      reveal: "fade",
      tilt: false,
      tiltFactor: 5,
      magnify: 1,
      on: {
        init(instance) {
          console.log("liquidGL ready!", instance);
        },
      },
    });
  });
</script>`,
    dynamicRendering: `const glassEffect = liquidGL({
  target: ".liquidGL",
});

liquidGL.registerDynamic(".my-animated-element");

const mySplitText = SplitText.create(".my-text", { type: "lines" });
liquidGL.registerDynamic(mySplitText.lines);`,
    scrollSync: `<script>
  document.addEventListener("DOMContentLoaded", () => {
    const glassEffect = liquidGL({
      target: ".liquidGL",
    });

    const { lenis, locomotiveScroll } = liquidGL.syncWith();
  });
</script>`,
} as const

export const liquidGlQuickStart = {
    prerequisiteNote:
        'Add both html2canvas and liquidGL.js before initialising liquidGL(), normally at the end of the body.',
    dependencyNote:
        'html2canvas provides the high-resolution snapshot of the page background that liquidGL refracts. The library will throw if either dependency is missing.',
    htmlStructureNote:
        'Create a target element that receives the glass effect, then place visible content inside a child element that sits above the glass.',
    zIndexNote:
        'The target should have a high z-index so it sits above page content. Content with a higher z-index than the target is excluded from the lens.',
} as const

export const liquidGlDynamicRendering = {
    description:
        'Dynamic elements that intersect the glass pane should be registered so liquidGL can monitor them and update the texture when they change.',
    videoNote: 'Videos are automatically detected and do not need to be registered.',
    registrationTiming:
        'Register dynamic elements after initialising liquidGL(), but before calling liquidGL.syncWith() if scroll sync is used.',
} as const

export const liquidGlScrollSync = {
    description:
        'liquidGL.syncWith() integrates with popular smooth-scrolling libraries such as Lenis and Locomotive Scroll and handles render-loop synchronisation.',
    timingNote:
        'Include scroll library scripts before your main script, then call liquidGL.syncWith() after liquidGL() has been called.',
} as const

export const liquidGlOptions: LiquidGlOption[] = [
    {
        name: 'target',
        type: 'string',
        defaultValue: "'.liquidGL'",
        required: true,
        description: 'CSS selector for the element(s) to glassify.',
    },
    {
        name: 'snapshot',
        type: 'string',
        defaultValue: "'body'",
        description: 'CSS selector for the element to snapshot.',
    },
    {
        name: 'resolution',
        type: 'number',
        defaultValue: '2.0',
        description:
            'Resolution of the background snapshot, clamped from 0.1 to 3.0. Higher values are sharper but use more memory.',
    },
    {
        name: 'refraction',
        type: 'number',
        defaultValue: '0.01',
        description: 'Base refraction offset applied across the pane, from 0 to 1.',
    },
    {
        name: 'bevelDepth',
        type: 'number',
        defaultValue: '0.08',
        description: 'Additional refraction on the edge to simulate depth, from 0 to 1.',
    },
    {
        name: 'bevelWidth',
        type: 'number',
        defaultValue: '0.15',
        description: 'Width of the bevel zone as a fraction of the shortest side, from 0 to 1.',
    },
    {
        name: 'frost',
        type: 'number',
        defaultValue: '0',
        description: 'Blur radius in pixels for a frosted look. 0 is clear.',
    },
    {
        name: 'shadow',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Toggles a subtle drop-shadow under the pane.',
    },
    {
        name: 'specular',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Enables animated specular highlights that move with time.',
    },
    {
        name: 'reveal',
        type: 'string',
        defaultValue: "'fade'",
        description: "Reveal animation. Use 'none' to render immediately or 'fade' to smoothly fade in.",
    },
    {
        name: 'tilt',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Enables 3D tilt interaction on cursor movement.',
    },
    {
        name: 'tiltFactor',
        type: 'number',
        defaultValue: '5',
        description: 'Depth of the tilt in degrees. 0 to 25 is recommended.',
    },
    {
        name: 'magnify',
        type: 'number',
        defaultValue: '1',
        description: 'Magnification factor of the lens, clamped from 0.001 to 3.0. 1 is no magnification.',
    },
    {
        name: 'on.init',
        type: 'function',
        defaultValue: '-',
        description: 'Callback that runs once the first render completes. Receives the lens instance.',
    },
]

export const liquidGlPresets: LiquidGlPreset[] = [
    {
        name: 'Default',
        settings: {
            refraction: 0,
            bevelDepth: 0.052,
            bevelWidth: 0.211,
            frost: 2,
            shadow: true,
            specular: true,
        },
        purpose: 'Balanced default used in the demo.',
    },
    {
        name: 'Alien',
        settings: {
            refraction: 0.073,
            bevelDepth: 0.2,
            bevelWidth: 0.156,
            frost: 2,
            shadow: true,
            specular: false,
        },
        purpose: 'Strong refraction and deep bevel for a sci-fi look.',
    },
    {
        name: 'Pulse',
        settings: {
            refraction: 0.03,
            bevelDepth: 0,
            bevelWidth: 0.273,
            frost: 0,
            shadow: false,
            specular: false,
        },
        purpose: 'Flat pane with wide bevel, useful for pulsing UI effects.',
    },
    {
        name: 'Frost',
        settings: {
            refraction: 0,
            bevelDepth: 0.035,
            bevelWidth: 0.119,
            frost: 0.9,
            shadow: true,
            specular: true,
        },
        purpose: 'Softly diffused, privacy-glass style.',
    },
    {
        name: 'Edge',
        settings: {
            refraction: 0.047,
            bevelDepth: 0.136,
            bevelWidth: 0.076,
            frost: 2,
            shadow: true,
            specular: false,
        },
        purpose: 'Thin bevel and bright rim highlights.',
    },
]

export const liquidGlFaq: LiquidGlFaq[] = [
    {
        question: 'Is there a resize handler?',
        answer: 'Yes. Resize is handled in the library and debounced to 250ms for performance.',
    },
    {
        question: 'Does the effect work on mobile?',
        answer: 'Yes. The library handles all 3 versions of WebGL and provides a frosted CSS backdrop-filter as a backup for older devices.',
    },
    {
        question: 'I have a preloader, how should I initialise liquidGL()?',
        answer: "Add the data-liquid-ignore attribute to your preloader's top-level container to exclude it from the snapshot, then call liquidGL() inside a DOMContentLoaded listener.",
    },
    {
        question: 'What is the correct way to use liquidGL with page animations?',
        answer: 'Set data-liquid-ignore on your preloader, animate the preloader and initial states, call liquidGL(), then optionally run post-snapshot scripts in on.init().',
    },
    {
        question: 'Can I use liquidGL on multiple elements?',
        answer: 'Yes. Any element matching the target selector will be glassified, but all target elements must share the same z-index due to shared canvas optimisations.',
    },
    {
        question: 'Will the library exceed WebGL contexts or have other performance issues?',
        answer: 'No. The library uses a shared canvas for all instances and has been tested with up to 30 elements on one page without causing performance problems or crashes.',
    },
    {
        question: 'Are there any animation limitations?',
        answer: 'Rotation and scale can be CPU/GPU expensive. Shadow, specular, and tilt should be used carefully when there are many instances or complex animations.',
    },
]

export const liquidGlImportantNotes = [
    'Register dynamic elements with liquidGL.registerDynamic() for real-time refraction, and set initial animation states before calling liquidGL().',
    'The library ignores fixed-position elements to avoid a known html2canvas issue on mobile browsers.',
    'Multiple instances must share the same z-index. If different z-index values are used, liquidGL applies the highest value to all target elements.',
    "For complex pages, snapshot a smaller element with the snapshot option, for example snapshot: '.my-background'.",
    'The initial capture is asynchronous. Call liquidGL() inside DOMContentLoaded or load to ensure content is available.',
    'Extremely long documents can exceed GPU texture limits. Segment long pages or reduce the resolution parameter.',
    'Shadow and tilt create layers behind the target element. Shadow uses z-index - 2 and the tilt helper canvas uses z-index - 1.',
    'Images inside the target element need permissive Access-Control-Allow-Origin headers to avoid CORS issues.',
]

export const liquidGlBrowserSupport: LiquidGlBrowserSupport[] = [
    { browser: 'Google Chrome', supported: true },
    { browser: 'Safari', supported: true },
    { browser: 'Firefox', supported: true },
    { browser: 'Microsoft Edge', supported: true },
]

export const liquidGlBrowserNote =
    'The library is compatible with WebGL-enabled browsers on desktop, tablet, and mobile. Safari can be unstable when liquid elements are more than 50% of the viewport width or height, so target-device testing is recommended.'

export const liquidGlOtherNotes = {
    excludeElements:
        'Set data-liquid-ignore on the parent container of elements that should be ignored by refraction.',
    contentVisibility:
        'Use z-index: 3 on content inside the target element so it sits above the lens. mix-blend-mode: difference can improve legibility.',
    borderRadius:
        'liquidGL inherits the border-radius of the target element, including animated border-radius values.',
} as const

export const liquidGlLicense = {
    type: 'MIT',
    holder: 'NaughtyDuk',
} as const

export const liquidGlDocs = {
    intro: liquidGlIntro,
    links: liquidGlLinks,
    features: liquidGlFeatures,
    scripts: liquidGlScripts,
    codeExamples: liquidGlCodeExamples,
    quickStart: liquidGlQuickStart,
    dynamicRendering: liquidGlDynamicRendering,
    scrollSync: liquidGlScrollSync,
    options: liquidGlOptions,
    presets: liquidGlPresets,
    faq: liquidGlFaq,
    importantNotes: liquidGlImportantNotes,
    browserSupport: liquidGlBrowserSupport,
    browserNote: liquidGlBrowserNote,
    otherNotes: liquidGlOtherNotes,
    license: liquidGlLicense,
} as const
