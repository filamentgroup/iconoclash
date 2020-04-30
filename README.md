## Iconoclash

A workflow for configurable external svg sets.


## How it works:

Pass an array of SVG files to iconoclash and it will combine them into a single SVG file with each file still referenceable by name. For example, once this icons.svg file is generated, your SVG files will be addressable by ID within that file, so if you started with an SVG called vespa.svg, you can reference  it from your page like this:

 ```html
<svg width="100" height="100">
    <use xlink:href="icons.svg#vespa"></use>
 </svg>
```

That single Icons.svg file can be used for all icons throughout your site and it only needs to load once, which is nice for performance and caching. However, a typical downside to using external SVG like this is that you can't easily use CSS to style particular shapes within that external SVG, say, to change the fill color of a particular group, or animate a path. 

2. Iconoclash makes this problem go away by exposing overrideable CSS custom properties on the SVG elements you'd like to style. Any SVG elements inside those files can have an ID attribute value that specifies CSS properties to expose globally so they can be customized. To specify properties, add the word `iconoclash` to the ID attribute followed by CSS property names you'd like to expose. For example, consider how this `g` element inside a file called vespa.svg gets transformed:
 - Before:  `<g fill="#E2574C" id="iconoclash fill">`
 - After:   `<g fill="#E2574C" style="fill: var(--vespa-g1-fill)">`
or...
 - Before:  `<g fill="#E2574C" id="iconoclash fill transform">`
 - After:   `<g fill="#E2574C" style="fill: var(--vespa-g1-fill); transform: var(--vespa-g1-transform)">`

Iconoclash sets the defaults for each of these CSS custom properties either to an existing value on the shape, or to 'initial'. Like this:
``` css
/* Iconoclash: CSS properties exposed from SVGs */
:root {
--baseball-g1-fill:#E2574C;
--baseball-g1-transform:initial;
}
```

These custom properties can be overridden from the HTML or another stylesheet, either globally, or to particular selectors or media queries.

```html
<svg width="100" height="100">
    <use xlink:href="icons.svg#baseball" style="--baseball-g1-fill:blue;--baseball-g1-transform:rotate(90deg);"></use>
 </svg>
 ```
